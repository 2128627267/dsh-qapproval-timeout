// dsh-approval-timeout Host half — 批准等待超时：超过设定时间未响应自动视为拒绝（先不弄）
return {
  async apply(ctx) {
    const get = (name) => ctx.get(name)
    const fsSvc = get('fs')
    const timer = get('timer')
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

    // 拦截 approval/request（waterfall）：超时未响应 → 返回 rejected
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
        ctx.logger && ctx.logger.warn ? ctx.logger.warn('approval-timeout: 批准超时（' + cfg.seconds + 's），自动拒绝') : console.log('approval-timeout: 批准超时，自动拒绝')
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
