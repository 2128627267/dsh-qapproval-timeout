// dsh-approval-timeout Client half — “批准超时”设置页：开关 + 等待秒数
return {
  async apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    styles.insert(`
      .dshf { font-size: 13px; line-height: 1.55; color: var(--dsw-alias-label-primary, #111827); }
      .dshf h3 { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary, #111827); }
      .dshf .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .dshf .card { border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.15)); border-radius: 8px; padding: 12px 14px; margin: 10px 0; background: var(--dsw-alias-bg-layer-1, #ffffff); }
      .dshf input { background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #111827); border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.15)); border-radius: 6px; padding: 6px 10px; font-size: 13px; box-sizing: border-box; }
      .dshf input:focus { outline: none; border-color: var(--dsw-alias-brand-primary, #2563eb); }
      .dshf button { background: var(--dsw-alias-bg-layer-2, #f3f4f6); color: var(--dsw-alias-label-primary, #111827); border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.15)); border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 13px; }
      .dshf button:hover { border-color: var(--dsw-alias-label-secondary, #4b5563); }
      .dshf button.primary { background: var(--dsw-alias-brand-primary, #2563eb); border-color: transparent; color: var(--dsw-alias-label-primary-foreground, #ffffff); }
      .dshf .muted { opacity: .62; font-size: 12px; color: var(--dsw-alias-label-secondary, #4b5563); }
      .dshf .hint { font-size: 12px; opacity: .75; background: var(--dsw-alias-bg-layer-2, #f3f4f6); border-radius: 8px; padding: 8px 10px; margin: 8px 0; white-space: pre-wrap; color: var(--dsw-alias-label-secondary, #4b5563); }
    `)
    const h = React.createElement
    const el = (type, props, ...children) => h(type, props || {}, ...children)
    const call = (method, args) => host.call(method, args || {}).catch((e) => ({ error: String((e && e.message) || e) }))

    function useData(method) {
      const [state, setState] = React.useState({ loading: true, data: null, error: null })
      React.useEffect(() => {
        let alive = true
        host.call(method, {})
          .then((d) => { if (alive) setState({ loading: false, data: d, error: null }) })
          .catch((e) => { if (alive) setState({ loading: false, data: null, error: String((e && e.message) || e) }) })
        return () => { alive = false }
      }, [method])
      return state
    }

    function ApprovalTimeoutPage() {
      const [form, setForm] = React.useState({ enabled: false, seconds: 120 })
      const [msg, setMsg] = React.useState('')
      const st = useData('approval-timeout/get')
      React.useEffect(() => {
        if (st.data && !st.data.error) setForm({ enabled: !!st.data.enabled, seconds: st.data.seconds || 120 })
      }, [st.data])
      const save = async () => {
        const r = await call('approval-timeout/set', { enabled: form.enabled, seconds: Number(form.seconds) || 120 })
        setMsg(r.error ? '✗ ' + r.error : '✓ 已保存（当前 ' + (r.enabled ? '启用，超时 ' + r.seconds + ' 秒' : '关闭') + '）')
      }
      if (st.loading) return el('div', { className: 'muted dshf' }, '加载中…')
      return el('div', { className: 'dshf' },
        el('h3', null, '批准超时 Approval Timeout'),
        el('div', { className: 'hint' }, '当需要你批准的操作（如沙箱升级/权限请求）超过设定时间未响应时，自动视为拒绝（"先不弄"），避免无限等待阻塞任务。' +
          '超时自动返回 rejected；你稍后仍可手动重新触发操作。'),
        el('div', { className: 'card' },
          el('div', { className: 'row', style: { marginBottom: 10 } },
            el('label', null, el('input', { type: 'checkbox', checked: form.enabled, onChange: (e) => setForm({ ...form, enabled: e.target.checked }) }), ' 启用批准超时')),
          el('div', { className: 'row' },
            el('span', { className: 'muted' }, '等待秒数：'),
            el('input', { style: { width: 120 }, type: 'number', min: 5, max: 3600, value: form.seconds, onChange: (e) => setForm({ ...form, seconds: e.target.value }) }),
            el('button', { className: 'primary', onClick: save }, '保存')),
          msg ? el('div', { className: 'muted', style: { marginTop: 8 } }, msg) : null),
        el('div', { className: 'muted' }, '说明：DSH 内置审批无超时机制（结果仅 allowed-once / rejected / cancelled / unavailable），本插件通过 approval/request 瀑布流拦截实现。超时后未决的审批请求结果会被丢弃。'),
      )
    }

    slots.inject('settings.section', () =>
      slots.register({ name: 'settings.section', id: 'dsh-approval-timeout', order: 95, label: () => '批准超时' }, () => el(ApprovalTimeoutPage)))
  },
}
