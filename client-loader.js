// AUTO-GENERATED static client bundle for dsh-approval-timeout.
// This file is served as the package's /plugins/<id>/client.js bundle and MUST
// be a classic script: it registers the package through
// window.__ModuleLoader__.load and must stay free of top-level import/export.
// The loader itself never blocks DSH boot: it declares no inject dependencies,
// catches every error, and retries in the background when services or the
// current session are not ready yet.
(function () {
  var win = typeof window === 'undefined' ? undefined : window
  var loader = win && win.__ModuleLoader__
  if (!loader || typeof loader.load !== 'function') return
  loader.load({
    id: "dsh-approval-timeout",
    factory: function (require) {
      var module = { exports: {} }
      var exports = module.exports
      Object.defineProperty(exports, '__esModule', { value: true })

      var PLUGIN_NAME = "dsh-approval-timeout-client-loader"
      var RECONCILE_KEY = '__dshQfBundleReconcileDone'
      var ATTEMPT_KEY = '__dshQfBundleReconcileAttempts'
      var MAX_ATTEMPTS = 20

      function log(message, error) {
        try { console.error(PLUGIN_NAME + ': ' + message, error || '') } catch (ignore) { /* never let logging break the app */ }
      }
      function getService(ctx, key) {
        try { return ctx ? ctx[key] : undefined } catch (error) { return undefined }
      }
      function currentSessionId(ctx) {
        try {
          var sessions = getService(ctx, 'sessions')
          return sessions && sessions.list && typeof sessions.list.getSnapshot === 'function'
            ? sessions.list.getSnapshot().current
            : undefined
        } catch (error) { return undefined }
      }
      function rowsForCurrentSession(ctx, rows) {
        var sessionId = currentSessionId(ctx)
        if (sessionId === undefined || sessionId === null || sessionId === '') return undefined
        if (!Array.isArray(rows)) return []
        return rows.filter(function (row) {
          return String(row && row.agentId) === String(sessionId)
        })
      }
      function autoStartRunning(runner, rows) {
        if (!runner || typeof runner.startUserRun !== 'function' || typeof runner.isLoaded !== 'function') return
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i]
          var attempt = row && row.latestRun
          if (!attempt || attempt.status !== 'running') continue
          var pkg
          if (Array.isArray(row.packages)) {
            for (var j = 0; j < row.packages.length; j++) {
              if (row.packages[j] && row.packages[j].packageId === attempt.packageId) { pkg = row.packages[j]; break }
            }
          }
          if (!pkg || !pkg.hasClientHalf) continue
          try {
            if (runner.isLoaded(row.pluginId)) continue
            var started = runner.startUserRun({
              agentId: row.agentId,
              pluginId: row.pluginId,
              packageId: attempt.packageId,
              mode: attempt.mode || 'run',
              hasClientHalf: true
            })
            if (started && typeof started.catch === 'function') {
              started.catch(function (error) { log('auto-start failed', error) })
            }
          } catch (error) { log('auto-start failed', error) }
        }
      }
      function reconcile(ctx) {
        try {
          var runner = getService(ctx, 'dynamicCordisRunner')
          if (!runner || typeof runner.reconcileApprovals !== 'function') return Promise.resolve(false)
          var remote
          try { remote = ctx && ctx.remote } catch (error) { remote = undefined }
          var inventory = remote && remote.dynamicCordisRunner && typeof remote.dynamicCordisRunner.inventory === 'function'
            ? remote.dynamicCordisRunner.inventory()
            : Promise.resolve(undefined)
          return Promise.resolve(inventory)
            .then(function (answered) {
              if (!answered || answered.ok !== true || !Array.isArray(answered.value)) return false
              var rows = rowsForCurrentSession(ctx, answered.value)
              if (!rows) return false
              runner.reconcileApprovals(rows)
              autoStartRunning(runner, rows)
              return true
            })
            .catch(function (error) {
              log('inventory reconcile failed', error)
              return false
            })
        } catch (error) {
          log('reconcile failed', error)
          return Promise.resolve(false)
        }
      }
      function schedule(ctx) {
        if (globalThis[RECONCILE_KEY]) return
        var attempts = globalThis[ATTEMPT_KEY] || 0
        if (attempts >= MAX_ATTEMPTS) return
        globalThis[ATTEMPT_KEY] = attempts + 1
        globalThis[RECONCILE_KEY] = true
        Promise.resolve(reconcile(ctx)).then(function (ok) {
          if (ok) return
          globalThis[RECONCILE_KEY] = false
          var delay = Math.min(500 * Math.pow(2, attempts), 5000)
          try { setTimeout(function () { schedule(ctx) }, delay) } catch (error) { globalThis[RECONCILE_KEY] = false }
        }, function (error) {
          globalThis[RECONCILE_KEY] = false
          log('schedule failed', error)
          var delay = Math.min(500 * Math.pow(2, attempts), 5000)
          try { setTimeout(function () { schedule(ctx) }, delay) } catch (ignore) { /* stop retrying */ }
        })
      }
      function apply(ctx) {
        schedule(ctx)
      }

      exports.name = PLUGIN_NAME
      exports.inject = []
      exports.apply = apply
      return module.exports
    }
  })
})()
