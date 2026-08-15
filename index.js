// AUTO-GENERATED bundle bootstrap for dsh-approval-timeout.
// Edit host.js/client.js, then regenerate with: node scripts/convert-to-bundle.js <pluginDir>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_DIR = fileURLToPath(new URL('.', import.meta.url))
const PLUGIN_NAME = "dsh-approval-timeout"
const ID_PREFIX = "qaptm"
const PURPOSE = "Approval timeout for DeepSeek Harness: when a sandbox/escalation approval is not answered within a configurable period, the request is automatically rejected instead of waiting forever."
const HOST_FILE = "host.js"
const CLIENT_FILE = "client.js"

export const name = PLUGIN_NAME
export const inject = ['dynamicCordisRunner', 'agents']

function log(ctx, message) {
  try {
    if (ctx?.logger?.info) ctx.logger.info(`[${PLUGIN_NAME}] ${message}`)
    else if (ctx?.logger?.warn) ctx.logger.warn(`[${PLUGIN_NAME}] ${message}`)
  } catch { /* ignore */ }
}

function rootAgents(agents) {
  try { return typeof agents?.roots === 'function' ? agents.roots() : [] } catch { return [] }
}

function archivedSet(workspaceSvc) {
  const archived = new Set()
  try {
    for (const id of workspaceSvc?.archivedSessionIds ?? []) archived.add(String(id))
  } catch { /* ignore */ }
  return archived
}

function workspaceKeyOf(sessionId, workspaceSvc) {
  try {
    for (const ws of workspaceSvc?.list?.() ?? []) {
      if ((ws?.sessionIds ?? []).some((id) => String(id) === String(sessionId))) {
        return String(ws?.id ?? ws?.path ?? 'default')
      }
    }
  } catch { /* ignore */ }
  return 'default'
}

/**
 * One bootstrap target per workspace (or one total when the workspace service
 * is unavailable): the newest non-archived root session. Restoring every root
 * used to duplicate each bundle in every old session and made tool names
 * (kb_search / rules_read / browser_open) collide across those duplicates.
 */
function startupTargets(agents, workspaceSvc) {
  const roots = rootAgents(agents)
  if (roots.length === 0) return []
  const archived = archivedSet(workspaceSvc)
  const live = roots.filter((agent) => agent?.session?.id && !archived.has(String(agent.session.id)))
  const candidates = live.length > 0 ? live : roots
  const groups = new Map()
  for (const agent of candidates) {
    const key = workspaceKeyOf(agent.session.id, workspaceSvc)
    const list = groups.get(key) ?? []
    list.push(agent)
    groups.set(key, list)
  }
  return [...groups.values()].map((list) => list.reduce((newest, agent) => {
    const a = Number(newest?.session?.createdAt ?? 0)
    const b = Number(agent?.session?.createdAt ?? 0)
    return b > a ? agent : newest
  }, list[0])).filter(Boolean)
}

function isStartupTarget(agent, agents, workspaceSvc) {
  try {
    return startupTargets(agents, workspaceSvc).some((candidate) => candidate === agent
      || candidate?.id !== undefined && candidate.id === agent?.id)
  } catch { return false }
}

function isArchived(agent, workspaceSvc) {
  if (!agent?.session?.id || !workspaceSvc?.archivedSessionIds) return false
  try { return workspaceSvc.archivedSessionIds.some((id) => String(id) === String(agent.session.id)) } catch { return false }
}

function existingPlugin(runner, sessionId) {
  try {
    if (typeof runner?.registry?.all !== 'function') return undefined
    return runner.registry.all().find((plugin) => plugin?.sessionId === sessionId
      && [...(plugin.packages?.values?.() ?? [])].some((definition) => definition?.name === PLUGIN_NAME))
  } catch { return undefined }
}

function latestPackage(plugin) {
  const candidates = [...(plugin?.packages?.values?.() ?? [])].filter((definition) => definition?.name === PLUGIN_NAME)
  return candidates[candidates.length - 1]
}

function preApprove(plugin, packageId) {
  try {
    plugin?.approvedClientPackages?.add?.(packageId)
    if (plugin && 'clientVersionUpdatesApproved' in plugin) plugin.clientVersionUpdatesApproved = true
  } catch { /* ignore */ }
}

async function activate(runner, agent, plugin, packageId) {
  // Pre-authorize the exact installed package, then arm the STANDARD run
  // request and return. The browser-side client-loader owns both halves from
  // here: it reconciles the request (runHostHalf), loads the client half and
  // settles activation. Calling runHostHalf immediately on the host used to
  // race that reconcile and produced "run request no longer identifies the
  // latest run" failures.
  preApprove(plugin, packageId)
  const mode = plugin?.currentPackageId !== undefined && plugin.currentPackageId !== packageId ? 'update' : 'run'
  if (typeof runner?.run === 'function') {
    return await runner.run(agent, plugin.pluginId, packageId, mode)
  }
  return await runner?.runHostHalf?.(agent, plugin.pluginId, packageId, mode, null, false)
}

export async function apply(ctx) {
  try {
    const runner = ctx.get('dynamicCordisRunner')
    const agents = ctx.get('agents')
    if (!runner || !agents) { log(ctx, 'skip: dynamicCordisRunner/agents unavailable'); return }

    const hostCode = HOST_FILE ? readFileSync(join(PKG_DIR, HOST_FILE), 'utf8') : undefined
    const clientCode = CLIENT_FILE ? readFileSync(join(PKG_DIR, CLIENT_FILE), 'utf8') : undefined
    const code = {}
    if (hostCode !== undefined) code.host = hostCode
    if (clientCode !== undefined) code.client = clientCode
    if (Object.keys(code).length === 0) { log(ctx, 'skip: no host/client source'); return }

    const workspaceSvc = typeof ctx.get === 'function' ? ctx.get('workspace') : undefined
    const busy = new Set()
    async function ensureForAgent(agent) {
      if (!agent?.session?.id) return
      const roots = rootAgents(agents)
      if (!roots.some((candidate) => candidate === agent || candidate?.id === agent?.id)) return
      const sessionId = agent.session.id
      if (busy.has(sessionId)) return
      busy.add(sessionId)
      try {
        let plugin = existingPlugin(runner, sessionId)
        let packageId
        if (plugin) {
          if (plugin.run !== undefined) { log(ctx, `session ${sessionId}: already running`); return }
          packageId = latestPackage(plugin)?.packageId
          if (!packageId) { log(ctx, `session ${sessionId}: no package to run`); return }
        } else {
          const defined = runner.define({
            sessionId,
            name: PLUGIN_NAME,
            purpose: PURPOSE,
            plugin: { kind: 'new', idPrefix: ID_PREFIX },
            code,
          })
          if (!defined?.pluginId) { log(ctx, 'define returned no pluginId'); return }
          packageId = defined.packageId
          plugin = typeof runner.registry?.get === 'function' ? runner.registry.get(defined.pluginId) : undefined
          if (!plugin) plugin = existingPlugin(runner, sessionId)
        }
        if (!plugin) { log(ctx, 'plugin record unavailable after define'); return }
        const result = await activate(runner, agent, plugin, packageId)
        log(ctx, `session ${sessionId} plugin=${plugin.pluginId} -> ${JSON.stringify(result)}`)
      } catch (error) {
        log(ctx, `session restore failed: ${error?.message || error}`)
      } finally {
        busy.delete(sessionId)
      }
    }

    // Register first so an agent created during startup is not missed.
    try {
      ctx.on('agent/created', (payload) => {
        const agent = payload?.agent
        if (!agent || isArchived(agent, workspaceSvc)) return
        if (!isStartupTarget(agent, agents, workspaceSvc)) {
          log(ctx, `session ${agent.session?.id}: not the latest workspace session; skip`)
          return
        }
        ensureForAgent(agent).catch((error) => log(ctx, `agent/created error: ${error?.message || error}`))
      })
    } catch { /* ignore */ }

    for (const agent of startupTargets(agents, workspaceSvc)) await ensureForAgent(agent)
  } catch (error) {
    log(ctx, `apply failed: ${error?.message || error}`)
  }
}
