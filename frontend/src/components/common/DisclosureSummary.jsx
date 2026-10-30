import { ChevronDown } from 'lucide-react'

// Native details keeps form drafts mounted while collapsed and supports Enter/Space.
export default function DisclosureSummary({ children, className = '', ...props }) {
  return <summary {...props} className={`ui-disclosure-trigger ${className}`}>
    <span className="ui-disclosure-label">{children}</span>
    <ChevronDown size={18} className="ui-disclosure-chevron" aria-hidden="true" />
  </summary>
}
