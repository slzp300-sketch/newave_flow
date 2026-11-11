export function changeState(entries) {
  const states = [...entries].map(read => read())
  return { dirty: states.some(s => s.dirty), busy: states.some(s => s.busy) }
}

export function leavesScreen(current, next) {
  return current.pathname !== next.pathname || current.search !== next.search
}

// Form values only; drafts remain in React memory, never browser storage.
export function formSnapshot(value) {
  return JSON.stringify(value, (_, item) => typeof File !== 'undefined' && item instanceof File
    ? { name: item.name, size: item.size, modified: item.lastModified } : item)
}
