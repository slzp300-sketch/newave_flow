import { MENU_GROUPS, PERSONAL_GROUPS } from './menuGroups.js'

const ROUTES = Object.entries({
  '/praise': 'praise',
  '/intercession': 'prayer',
  '/officers': 'assignment',
  '/admin/attendance': 'attendance',
  '/safety/report': 'safety',
  '/community-guidelines': 'safety',
  '/admin/content-reports': 'safety',
  '/admin/content-photos': 'safety',
  '/attendance': 'attendance',
  '/new-family': 'newFamily',
  '/admin/weekly-report': 'weeklyReport',
  '/event-attendance': 'eventAttendance',
  '/tts': 'tts',
  '/calendar': 'calendar',
  '/events': 'calendar',
  '/meeting/prayer': 'prayer',
  '/meeting/sat': 'meeting',
  '/roster': 'roster',
  '/students': 'roster',
  '/class-manage': 'classManage',
  '/minutes': 'minutes',
  '/evangelism': 'evangelism',
  '/notifications': 'notifications',
  '/checklist': 'checklist',
  '/menu': 'menu',
  '/profile': 'profile',
  '/admin': 'admin',
  '/admin/student-attendance': 'attendance',
  '/admin/event-attendance': 'eventAttendance',
  '/admin/tts': 'tts',
  '/admin/calendar': 'calendar',
  '/admin/prayer': 'prayer',
  '/admin/meeting-attendance': 'meeting',
  '/admin/minutes': 'minutes',
  '/admin/evangelism': 'evangelism',
  '/admin/pending-users': 'approvals',
  '/admin/teachers': 'teachers',
  '/admin/students': 'students',
  '/admin/class-assignment': 'assignment',
  '/admin/deactivation-requests': 'deactivation',
}).sort(([a], [b]) => b.length - a.length)


export function featureIdentity(path = '') {
  const pathname = path.split(/[?#]/, 1)[0]
  return ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))?.[1]
}

// Match the page route so personal and management sections can share an icon
// while keeping each section's card and heading colors consistent.
const SECTION_ROUTES = [...MENU_GROUPS, ...PERSONAL_GROUPS]
  .flatMap(group => group.items.map(item => [item.to, group.tone]))
  .sort(([a], [b]) => b.length - a.length)
const OTHER_TONES = {
  calendar: 'amber', roster: 'blue', checklist: 'teal', notifications: 'amber',
  profile: 'violet', safety: 'slate',
}
export function featureTone(path = '') {
  const pathname = path.split(/[?#]/, 1)[0]
  if (pathname === '/') return 'teal'
  return SECTION_ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))?.[1]
    || OTHER_TONES[featureIdentity(pathname)] || 'blue'
}
