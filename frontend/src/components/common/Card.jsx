export default function Card({ children, className = '', onClick, reveal = true }) {
  const interactive = onClick ? {
    role: 'button', tabIndex: 0, onClick,
    onKeyDown: e => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick(e)
      }
    },
  } : {}
  return <div className={`glass-card rounded-2xl p-4 relative ${reveal ? 'motion-card' : ''} ${onClick ? 'brand-action motion-card-interactive cursor-pointer' : ''} ${className}`} {...interactive}>{children}</div>
}
