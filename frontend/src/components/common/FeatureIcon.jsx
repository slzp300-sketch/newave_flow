import { featureIdentity } from '../../utils/featureAppearance'
import {
  UserRoundCheck, Ticket, BookOpen, CalendarDays, HandHeart, Presentation,
  ContactRound, School, NotebookPen, Route, Bell, ListChecks, ShieldCheck,
  BadgeCheck, KeyRound, GraduationCap, Network, UserRoundMinus, LayoutGrid,
  UserRound, ShieldAlert, UsersRound, FileText, Music2,
} from 'lucide-react'

// Page identity only. Save, completion, warning and input-state icons stay independent.
const SYMBOLS = {
  praise: Music2,
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


export default function FeatureIcon({ path = '', feature, size = 32, className = '' }) {
  const identity = feature || featureIdentity(path)
  const Icon = SYMBOLS[identity]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={2.1} aria-hidden="true" focusable="false"
    data-feature-icon={identity} className={`shrink-0 ${className}`} />
}
