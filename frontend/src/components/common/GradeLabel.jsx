import { gradeClasses, gradeKey } from '../../utils/gradeColors'

// Text remains explicit: color is an extra cue, never the only grade identifier.
export default function GradeLabel({ value, children }) {
  if (!value) return children ?? null
  if (!gradeKey(value)) {
    const parts = String(value).split(/(\s*·\s*)/)
    if (!children && parts.length > 1) return <>{parts.map((part,index) => gradeKey(part) ? <GradeLabel key={index} value={part} /> : part)}</>
    return <>{children ?? value}</>
  }
  return <span data-grade={gradeKey(value)} className={`grade-label ${gradeClasses(value).bg}`}>{children ?? value}</span>
}
