// AUTO-GENERATED client loader for dsh-approval-timeout.
// Runs immediately at page boot: reads the process-wide dynamic plugin
// inventory once and asks the client runner to reconcile pending activations,
// so every pre-approved dynamic client half loads without opening Settings.
export const name = "dsh-approval-timeout-client-loader"
export const inject = ['dynamicCordisRunner']

const RECONCILE_KEY = '__dshQfBundleReconcileDone'

export function apply(ctx) {
  try {
    if (globalThis[RECONCILE_KEY]) return
    globalThis[RECONCILE_KEY] = true
    const runner = ctx.get('dynamicCordisRunner')
    if (!runner || typeof runner.reconcileApprovals !== 'function') return
    Promise.resolve(ctx.remote?.dynamicCordisRunner?.inventory?.())
      .then((answered) => {
        if (answered?.ok && Array.isArray(answered.value)) runner.reconcileApprovals(answered.value)
      })
      .catch((error) => {
        console.error('[dsh-approval-timeout-client-loader] inventory reconcile failed:', error)
      })
  } catch (error) {
    console.error('[dsh-approval-timeout-client-loader] apply failed:', error)
  }
}
