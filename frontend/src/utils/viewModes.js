export const STUDENT_ROSTER_MODES = Object.freeze(['large', 'list'])
export function resolveViewMode(saved, fallback, allowed = ['large','small','list','detail']) {
  return allowed.includes(saved) ? saved : allowed.includes(fallback) ? fallback : allowed[0]
}
