// AUTO-GENERATED client loader for dsh-approval-timeout.
// Runs immediately at page boot: reads the process-wide dynamic plugin
// inventory and asks the client runner to reconcile pending activations, so
// every pre-approved dynamic client half loads without opening Settings.
// Multiple installed qf bundles share one reconcile via a page-global guard.
export const name = "dsh-approval-timeout-client-loader"
export const inject = ['dynamicCordisRunner']

const RECONCILE_KEY = '__dshQfBundleReconcileDone'
const ATTEMPT_KEY = '__dshQfBundleReconcileAttempts'

function reconcile(ctx) {
  try {
    const runner = ctx.get('dynamicCordisRunner')
    if (!runner || typeof runner.reconcileApprovals !== 'function') return Promise.resolve(false)
    return Promise.resolve(ctx.remote?.dynamicCordisRunner?.inventory?.())
      .then((answered) => {
        if (!answered?.ok || !Array.isArray(answered.value)) return false
        runner.reconcileApprovals(answered.value)
        return true
      })
      .catch((error) => {
        console.error('[dsh-approval-timeout-client-loader] inventory reconcile failed:', error)
        return false
      })
  } catch (error) {
    console.error('[dsh-approval-timeout-client-loader] reconcile failed:', error)
    return Promise.resolve(false)
  }
}

export function apply(ctx) {
  if (globalThis[RECONCILE_KEY]) return
  const attempts = globalThis[ATTEMPT_KEY] || 0
  if (attempts >= 3) return
  globalThis[ATTEMPT_KEY] = attempts + 1
  globalThis[RECONCILE_KEY] = true
  Promise.resolve(reconcile(ctx)).then((ok) => {
    if (ok || attempts >= 2) return
    globalThis[RECONCILE_KEY] = false
    setTimeout(() => apply(ctx), 1000)
  })
}
