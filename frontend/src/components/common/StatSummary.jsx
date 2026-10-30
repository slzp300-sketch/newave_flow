export default function StatSummary({ items, label, className = '' }) {
  return <dl aria-label={label} className={`ui-metrics ui-metrics-auto ${className}`} style={{ '--metric-columns': items.length }}>
    {items.map(({ label: title, value, color, unit = '명' }) => <div key={title}>
      <dt>{title}</dt><dd className={color}>{value}{unit && value !== '—' && <small>{unit}</small>}</dd>
    </div>)}
  </dl>
}
