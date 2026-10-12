// Serialize writes: a late token refresh must not overwrite a subsequent logout.
// This adapter deliberately has no plaintext fallback.
export function createSecureStorage(plugin, onError = () => {}) {
  let pending = Promise.resolve()
  let failure = null
  function enqueue(work) {
    pending = pending.then(work).then(() => { failure = null }).catch(error => {
      failure = error
      onError(error)
    })
    return pending
  }
  return {
    async getItem(key) {
      await pending
      return (await plugin.get({ key })).value ?? null
    },
    setItem: (key, value) => enqueue(() => plugin.set({ key, value })),
    removeItem: key => enqueue(() => plugin.remove({ key })),
    async flush() {
      await pending
      if (failure) throw failure
    },
  }
}
