// dsh-qapproval-timeout — native DSH bundle host half.
// Standard Cordis plugin: intercepts approval/request with a configurable timeout.
import { join } from 'node:path'

export const name = 'dsh-qapproval-timeout'
export const inject = []

const TIMEOUT = '@dsh-qapproval-timeout@'

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (chunk) => {
      data += chunk
      if (data.length > 1024 * 1024) {
        reject(new Error('request body too large'))
        request.destroy()
      }
    })
    request.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch (error) { reject(error) }
    })
    request.on('error', reject)
  })
}

function sameOrigin(request) {
  try {
    const origin = request.headers.origin
    if (!origin) return true
    return new URL(origin).host === request.headers.host
  } catch { return false }
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

export async function apply(ctx) {
  const get = (key) => {
    try { return ctx.get(key) } catch { return undefined }
  }
  const fsSvc = get('fs')
  const timer = get('timer')
  const agentsSvc = get('agents')
  let cfg = { enabled: false, seconds: 120 }
  let dshHome = process.env.DSH_HOME || ''
  let workspaceRoot = process.cwd()

  async function resolveBase() {
    if (fsSvc) {
      try { workspaceRoot = await fsSvc.resolve('.', {}) } catch { /* ignore */ }
    }
    if (!dshHome) dshHome = workspaceRoot
  }

  async function readJson(rel) {
    try {
      if (!fsSvc) return null
      const target = await fsSvc.resolve(rel, {})
      return JSON.parse(await fsSvc.readText(target))
    } catch { return null }
  }
  async function writeJson(rel, value) {
    if (!fsSvc) return false
    try {
      const target = await fsSvc.resolve(rel, {})
      await fsSvc.writeText(target, JSON.stringify(value, null, 2))
      return true
    } catch { return false }
  }
  async function loadAll() {
    await resolveBase()
    const saved = await readJson(join(dshHome, '.dsh-features', 'approval-timeout.json'))
    if (saved && typeof saved === 'object') {
      if (typeof saved.enabled === 'boolean') cfg.enabled = saved.enabled
      if (typeof saved.seconds === 'number' && saved.seconds > 0) cfg.seconds = saved.seconds
    }
  }
  await loadAll().catch(() => {})

  async function notifyTimeout(agent, req, seconds) {
    const tool = (req && (req.toolName || req.tool)) || '（未知操作）'
    const reason = req && req.reason ? '，原因：' + req.reason : ''
    const text = '[批准超时] 你请求的「' + tool + '」' + reason + ' 因超过 ' + seconds + ' 秒未获得批准，已被自动视为拒绝（rejected）。' +
      '你可以自主决定：重新发起该操作、改用其他方式、或向用户说明后继续。'
    try {
      if (agent && typeof agent.followup === 'function') {
        await agent.followup({ role: 'user', content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'dsh-qapproval-timeout' } })
        return 'followup-ok'
      }
    } catch { /* ignore */ }
    try {
      const sessionsSvc = get('sessions')
      const session = sessionsSvc && typeof sessionsSvc.get === 'function' && agent ? sessionsSvc.get(agent.session ? agent.session.id : agent.id) : undefined
      if (session && typeof session.append === 'function') {
        session.append('user/message', { content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'dsh-qapproval-timeout' } })
        return 'log-ok'
      }
    } catch { /* ignore */ }
    return 'failed'
  }

  ctx.on('approval/request', async (req, next) => {
    if (!cfg.enabled || !timer || typeof timer.timeout !== 'function' || !(cfg.seconds > 0)) return next()
    let dispose = null
    let settled = false
    const timeoutPromise = new Promise((resolve) => {
      dispose = timer.timeout(() => {
        if (!settled) { settled = true; resolve(TIMEOUT) }
      }, cfg.seconds * 1000)
    })
    try {
      const outcome = await Promise.race([Promise.resolve().then(() => next()), timeoutPromise])
      if (!settled) {
        settled = true
        if (dispose) dispose()
      }
      if (outcome === TIMEOUT) {
        console.warn('approval-timeout: 批准超时（' + cfg.seconds + 's），自动拒绝')
        let agent = null
        try {
          if (req && req.agent) agent = req.agent
          else if (agentsSvc && typeof agentsSvc.roots === 'function') {
            const roots = agentsSvc.roots()
            agent = roots[0] || null
          }
        } catch { /* ignore */ }
        const notified = await notifyTimeout(agent, req, cfg.seconds)
        if (notified !== 'followup-ok' && notified !== 'log-ok') {
          console.warn('approval-timeout: 无法注入超时消息（' + notified + '）')
        }
        return 'rejected'
      }
      return outcome
    } catch (error) {
      if (!settled) {
        settled = true
        if (dispose) dispose()
      }
      throw error
    }
  })

  const api = {
    get: async () => ({ ...cfg }),
    set: async (args) => {
      await resolveBase()
      if (typeof args.enabled === 'boolean') cfg.enabled = args.enabled
      const seconds = Number(args.seconds)
      if (Number.isFinite(seconds) && seconds > 0 && seconds <= 3600) cfg.seconds = Math.round(seconds)
      await writeJson(join(dshHome, '.dsh-features', 'approval-timeout.json'), cfg)
      return { ...cfg }
    },
  }

  ctx.inject(['webServer'], (hostCtx) => {
    hostCtx.effect(() => {
      const routes = [
        ['/dsh-qapproval-timeout/get', 'GET', api.get],
        ['/dsh-qapproval-timeout/set', 'POST', api.set],
      ]
      const disposers = []
      for (const [path, method, handler] of routes) {
        const dispose = hostCtx.webServer.register({
          kind: 'exact',
          path,
          handler: async (request, response) => {
            if (request.method !== method) {
              response.writeHead(405, { allow: method })
              response.end()
              return
            }
            if (method === 'POST' && !sameOrigin(request)) {
              sendJson(response, 403, { error: 'untrusted origin' })
              return
            }
            try {
              const args = method === 'POST' ? await readJsonBody(request) : {}
              sendJson(response, 200, await handler(args))
            } catch (error) {
              sendJson(response, 500, { error: String((error && error.message) || error) })
            }
          },
        })
        disposers.push(dispose)
      }
      return () => { for (const dispose of disposers) { try { dispose() } catch { /* ignore */ } } }
    }, 'dsh-qapproval-timeout: http routes')
  })
}
