import {
  UserRoundCheck, Ticket, BookOpen, CalendarDays, HandHeart, Presentation,
  ContactRound, School, NotebookPen, Route, Bell, ListChecks, ShieldCheck,
  BadgeCheck, KeyRound, GraduationCap, Network, UserRoundMinus, LayoutGrid,
  UserRound, ShieldAlert, UsersRound, FileText,
} from 'lucide-react'

// Page identity only. Save, completion, warning and input-state icons stay independent.
const SYMBOLS = {
  safety: ShieldAlert,
  attendance: UserRoundCheck,
  newFamily: UsersRound,
  weeklyReport: FileText,
  eventAttendance: Ticket,
  tts: BookOpen,
  calendar: CalendarDays,
  prayer: HandHeart,
  meeting: Presentation,
  roster: ContactRound,
  classManage: School,
  minutes: NotebookPen,
  evangelism: Route,
  notifications: Bell,
  checklist: ListChecks,
  admin: ShieldCheck,
  approvals: BadgeCheck,
  teachers: KeyRound,
  students: GraduationCap,
  assignment: Network,
  deactivation: UserRoundMinus,
  menu: LayoutGrid,
  profile: UserRound,
}

const ROUTES = Object.entries({
  '/safety/report': 'safety',
  '/community-guidelines': 'safety',
  '/admin/content-reports': 'safety',
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

export default function FeatureIcon({ path = '', feature, size = 32, className = '' }) {
  const identity = feature || ROUTES.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))?.[1]
  const Icon = SYMBOLS[identity]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={2.1} aria-hidden="true" focusable="false"
    data-feature-icon={identity} className={`shrink-0 ${className}`} />
}
