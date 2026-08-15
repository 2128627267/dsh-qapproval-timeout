// dsh-qapproval-timeout — native DSH bundle client half (classic __ModuleLoader__ bundle).
window.__ModuleLoader__.load({ id: "dsh-qapproval-timeout", factory: (require) => {
  var module = { exports: {} }
  var exports = module.exports
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })

  var React = require("react")
  var name = "dsh-qapproval-timeout"
  var inject = ["slots"]

  function injectStyles(ctx, css) {
    try {
      var style = document.createElement("style")
      style.setAttribute("data-plugin", "dsh-qapproval-timeout")
      style.textContent = css
      document.head.appendChild(style)
      var cleanup = function () {
        try { if (style.parentNode) style.parentNode.removeChild(style) } catch (ignore) { /* ignore */ }
      }
      if (ctx && typeof ctx.effect === "function") {
        try { ctx.effect(function () { return cleanup }, "dsh-qapproval-timeout: styles") } catch (ignore) { /* ignore */ }
      }
      return cleanup
    } catch (ignore) { return function () {} }
  }

  function callApi(method, args) {
    return fetch("/dsh-qapproval-timeout/" + method, {
      method: method === "get" ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      body: method === "get" ? undefined : JSON.stringify(args || {})
    })
      .then(function (response) {
        return response.json().catch(function () { return {} }).then(function (body) {
          if (!response.ok) return { error: body.error || ("HTTP " + response.status) }
          return body
        })
      })
      .catch(function (error) { return { error: String((error && error.message) || error) } })
  }

  function apply(ctx) {
    var slots = ctx && ctx.slots
    if (!slots) return

    injectStyles(ctx, `
      .dshf { font-size: 13px; line-height: 1.55; color: var(--dsw-alias-label-primary, #111827); }
      .dshf h3 { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary, #111827); }
      .dshf .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .dshf .dshf-toggle { display: inline-flex; align-items: center; gap: 8px; }
      .dshf .dshf-toggle input[type='checkbox'] { width: auto; margin: 0; flex: none; }
      .dshf .card { border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.15)); border-radius: 8px; padding: 12px 14px; margin: 10px 0; background: var(--dsw-alias-bg-layer-1, #ffffff); }
      .dshf input:not([type='checkbox']) { background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, #111827); border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.15)); border-radius: 6px; padding: 6px 10px; font-size: 13px; box-sizing: border-box; }
      .dshf input:not([type='checkbox']):focus { outline: none; border-color: var(--dsw-alias-brand-primary, #2563eb); }
      .dshf button { background: var(--dsw-alias-bg-layer-2, #f3f4f6); color: var(--dsw-alias-label-primary, #111827); border: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.15)); border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 13px; }
      .dshf button:hover { border-color: var(--dsw-alias-label-secondary, #4b5563); }
      .dshf button.primary { background: var(--dsw-alias-brand-primary, #2563eb); border-color: transparent; color: var(--dsw-alias-label-primary-foreground, #ffffff); }
      .dshf .muted { opacity: .62; font-size: 12px; color: var(--dsw-alias-label-secondary, #4b5563); }
      .dshf .hint { font-size: 12px; opacity: .75; background: var(--dsw-alias-bg-layer-2, #f3f4f6); border-radius: 8px; padding: 8px 10px; margin: 8px 0; white-space: pre-wrap; color: var(--dsw-alias-label-secondary, #4b5563); }
    `)

    var h = React.createElement
    var el = function (type, props) {
      var children = Array.prototype.slice.call(arguments, 2)
      return h.apply(null, [type, props || {}].concat(children))
    }
    var call = callApi

    function ApprovalTimeoutPage() {
      var formState = React.useState({ enabled: false, seconds: 120 })
      var form = formState[0]
      var setForm = formState[1]
      var msgState = React.useState('')
      var msg = msgState[0]
      var setMsg = msgState[1]
      var dataState = React.useState({ loading: true, data: null, error: null })
      var st = dataState[0]
      var setSt = dataState[1]

      React.useEffect(function () {
        var alive = true
        setSt({ loading: true, data: null, error: null })
        call('get', {}).then(function (data) {
          if (alive) setSt({ loading: false, data: data, error: null })
        }).catch(function (error) {
          if (alive) setSt({ loading: false, data: null, error: String((error && error.message) || error) })
        })
        return function () { alive = false }
      }, [])

      React.useEffect(function () {
        if (st.data && !st.data.error) setForm({ enabled: !!st.data.enabled, seconds: st.data.seconds || 120 })
      }, [st.data])

      var save = async function () {
        var result = await call('set', { enabled: form.enabled, seconds: Number(form.seconds) || 120 })
        setMsg(result.error ? '✗ ' + result.error : '✓ 已保存（当前 ' + (result.enabled ? '启用，超时 ' + result.seconds + ' 秒' : '关闭') + '）')
      }

      if (st.loading) return el('div', { className: 'muted dshf' }, '加载中…')
      return el('div', { className: 'dshf' },
        el('h3', null, '批准超时 Approval Timeout'),
        el('div', { className: 'hint' }, '当需要你批准的操作（如沙箱升级/权限请求）超过设定时间未响应时，自动视为拒绝（"先不弄"），避免无限等待阻塞任务。' +
          '超时自动返回 rejected，并**向会话注入超时信息**（含操作名与原因），模型看到后自主决定：重试该操作、换方式、或继续。'),
        el('div', { className: 'card' },
          el('div', { className: 'row', style: { marginBottom: 10 } },
            el('label', { className: 'dshf-toggle' }, el('input', { type: 'checkbox', checked: form.enabled, onChange: function (event) { setForm(Object.assign({}, form, { enabled: event.target.checked })) } }), ' 启用批准超时')),
          el('div', { className: 'row' },
            el('span', { className: 'muted' }, '等待秒数：'),
            el('input', { style: { width: 120 }, type: 'number', min: 5, max: 3600, value: form.seconds, onChange: function (event) { setForm(Object.assign({}, form, { seconds: event.target.value })) } }),
            el('button', { className: 'primary', onClick: save }, '保存')),
          msg ? el('div', { className: 'muted', style: { marginTop: 8 } }, msg) : null),
        el('div', { className: 'muted' }, '说明：DSH 内置审批无超时机制（结果仅 allowed-once / rejected / cancelled / unavailable），本插件通过 approval/request 瀑布流拦截实现。超时后未决的审批请求结果会被丢弃。'),
      )
    }

    slots.inject('settings.section', function () {
      return slots.register({ name: 'settings.section', id: 'dsh-qapproval-timeout', order: 95, label: function () { return '批准超时' } }, function () { return el(ApprovalTimeoutPage) })
    })
  }

  exports.name = name
  exports.inject = inject
  exports.apply = apply
  return module.exports
}})
