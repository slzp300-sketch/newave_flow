import { DetailTable } from './ViewModeToggle'

// The original large cards stay available. Other views use the same filtered rows,
// fields and actions, so changing the presentation never changes a record.
export default function RecordViews({ mode, rows, columns, rowKey = row => row.id, onRowClick, rowClassName, children }) {
  if (!rows.length || (mode === 'large' && children != null)) return children ?? null
  if (mode === 'detail') return <DetailTable rows={rows} columns={columns} rowKey={rowKey} onRowClick={onRowClick} rowClassName={rowClassName} />
  const [title, ...fields] = columns
  return <div className={mode === 'small' ? 'readable-card-grid gap-2' : 'flex flex-col gap-2'}>
    {rows.map((row, index) => <article key={rowKey(row, index)} className={`brand-card min-w-0 rounded-2xl border border-gray-200 bg-white ${mode === 'large' ? 'p-5' : 'p-3'} ${rowClassName?.(row) || ''}`}>
      {onRowClick ? <button type="button" onClick={() => onRowClick(row)} className="min-h-11 w-full break-words text-left text-sm font-semibold text-primary-800">
        {title.render(row) ?? '—'}<span className="sr-only"> 상세 보기</span>
      </button> : <h3 className="break-words text-sm font-semibold text-gray-900">{title.render(row) ?? '—'}</h3>}
      <dl className={`mt-2 text-xs ${mode === 'list' ? 'flex flex-wrap gap-x-4 gap-y-2' : 'space-y-2'}`}>
        {fields.map(field => <div key={field.label} className={`min-w-0 ${field.action ? 'w-full' : mode === 'list' ? 'flex items-baseline gap-1.5' : ''}`}>
          <dt className="shrink-0 text-gray-500">{field.label}</dt>
          <dd className={`min-w-0 whitespace-normal break-words text-gray-800 [overflow-wrap:anywhere] ${mode === 'small' || field.action ? 'mt-1' : ''}`}>{displayValue(field.render(row))}</dd>
        </div>)}
      </dl>
    </article>)}
  </div>
}

const displayValue = value => value == null || value === '' ? '—' : value
