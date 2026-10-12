export default function Card({ children, className = '', onClick }) {
  const interactive = onClick ? {
    role: 'button', tabIndex: 0, onClick,
    onKeyDown: e => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick(e)
      }
    },
  } : {}
  return <div className={`glass-card rounded-2xl p-4 relative ${onClick ? 'cursor-pointer hover:border-primary-200' : ''} ${className}`} {...interactive}>{children}</div>
}
