// Viewport recovery must never turn a successful authentication into a failure.
export function createAuthViewport({ platform, native, document }) {
  const run = async (method, options) => {
    if (platform !== 'ios') return false
    try { await native[method](options); return true } catch { return false }
  }
  return {
    prepare: async () => {
      document?.activeElement?.blur?.()
      return run('prepare')
    },
    resume: () => run('restore', { finish: false, force: false }),
    finish: (force = true) => run('restore', { finish: true, force }),
  }
}
