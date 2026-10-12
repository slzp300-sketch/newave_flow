import { parentPath } from '../utils/navigation.js'

export function nativeBackDestination(path, historyIndex, saving) {
  if (saving) return { action: 'wait' }
  if (path === '/' || path === '/login') return { action: 'minimize' }
  if (historyIndex > 0) return { action: 'history' }
  return { action: 'navigate', path: parentPath(path) }
}
