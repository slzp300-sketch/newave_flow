export default function Brand({ emblem = false, light = false, className = '' }) {
  return (
    <span className={`newave-brand ${emblem ? 'newave-brand-emblem' : ''} ${light ? 'newave-brand-light' : ''} ${className}`}>
      <img src={`/brand/newave-${emblem ? 'emblem' : 'wordmark'}.svg`} alt="NEWAVE" />
      <span>FLOW</span>
    </span>
  )
}
