// dsh-approval-timeout Host half v1.3 — 批准等待超时：超时自动拒绝（返回 rejected）+ 向会话注入超时信息，让模型自主决定
return {
  async apply(ctx) {
    const get = (name) => ctx.get(name)
    const fsSvc = get('fs')
    const timer = get('timer')
    const agentsSvc = get('agents')
    const DIR = '.dsh-features'
    let cfg = { enabled: false, seconds: 120 }

    async function readJson(rel) {
      try {
        if (!fsSvc) return null
        const t = await fsSvc.resolve(rel, {})
        return JSON.parse(await fsSvc.readText(t))
      } catch { return null }
    }
    async function writeJson(rel, val) {
      if (!fsSvc) return false
      try {
        const t = await fsSvc.resolve(rel, {})
        await fsSvc.writeText(t, JSON.stringify(val, null, 2))
        return true
      } catch { return false }
    }
    async function loadAll() {
      const c = await readJson(DIR + '/approval-timeout.json')
      if (c && typeof c === 'object') {
        if (typeof c.enabled === 'boolean') cfg.enabled = c.enabled
        if (typeof c.seconds === 'number' && c.seconds > 0) cfg.seconds = c.seconds
      }
    }
    loadAll()

    const TIMEOUT = '@dsh-approval-timeout@'

    // 向所属会话注入超时信息（模型下一轮可见，自主决定是否重试）
    async function notifyTimeout(agent, req, seconds) {
      const tool = (req && (req.toolName || req.tool)) || '（未知操作）'
      const reason = req && req.reason ? '，原因：' + req.reason : ''
      const text = '[批准超时] 你请求的「' + tool + '」' + reason + ' 因超过 ' + seconds + ' 秒未获得批准，已被自动视为拒绝（rejected）。' +
        '你可以自主决定：重新发起该操作、改用其他方式、或向用户说明后继续。'
      try {
        if (agent && typeof agent.followup === 'function') {
          await agent.followup({ role: 'user', content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'dsh-approval-timeout' } })
          return 'followup-ok'
        }
      } catch { /* ignore */ }
      try {
        const sessionsSvc = get('sessions')
        const session = sessionsSvc && typeof sessionsSvc.get === 'function' && agent ? sessionsSvc.get(agent.session ? agent.session.id : agent.id) : undefined
        if (session && typeof session.append === 'function') {
          session.append('user/message', { content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'dsh-approval-timeout' } })
          return 'log-ok'
        }
      } catch { /* ignore */ }
      return 'failed'
    }

    // 拦截 approval/request（waterfall）：超时未响应 → 返回 rejected + 注入超时信息
    ctx.on('approval/request', async (req, next) => {
      if (!cfg.enabled || !timer || !(cfg.seconds > 0)) return next()
      let dispose = null
      let settled = false
      const timeoutPromise = new Promise((resolve) => {
        dispose = timer.timeout(() => {
          if (!settled) { settled = true; resolve(TIMEOUT) }
        }, cfg.seconds * 1000)
      })
      const outcome = await Promise.race([Promise.resolve(next()), timeoutPromise])
      if (!settled) {
        settled = true
        if (dispose) dispose()
      }
      if (outcome === TIMEOUT) {
        console.warn('approval-timeout: 批准超时（' + cfg.seconds + 's），自动拒绝')
        // 附加超时信息给模型：让模型自主决定
        let agent = null
        try {
          if (req && req.agent) agent = req.agent
          else if (agentsSvc && typeof agentsSvc.roots === 'function') {
            const roots = agentsSvc.roots()
            agent = roots[0] || null
          }
        } catch { /* ignore */ }
        const n = await notifyTimeout(agent, req, cfg.seconds)
        if (n !== 'followup-ok' && n !== 'log-ok') {
          console.warn('approval-timeout: 无法注入超时消息（' + n + '）')
        }
        return 'rejected'
      }
      return outcome
    })

    harness.handle('approval-timeout/get', async () => ({ ...cfg }))
    harness.handle('approval-timeout/set', async (args) => {
      if (typeof args.enabled === 'boolean') cfg.enabled = args.enabled
      const s = Number(args.seconds)
      if (Number.isFinite(s) && s > 0 && s <= 3600) cfg.seconds = Math.round(s)
      await writeJson(DIR + '/approval-timeout.json', cfg)
      return { ...cfg }
    })
  },
}
