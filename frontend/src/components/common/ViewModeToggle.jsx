import { useState, useEffect } from 'react'
import { LayoutGrid, Grid3x3, List, Table2 } from 'lucide-react'

const MODES = [
  { id: 'large',  label: '큰 카드',  Icon: LayoutGrid },
  { id: 'small',  label: '작은 카드', Icon: Grid3x3 },
  { id: 'list',   label: '목록',     Icon: List },
  { id: 'detail', label: '자세히',   Icon: Table2 },
]

/** 명단 보기 방식 (화면별로 기억 — 앱을 다시 열어도 유지) */
export function useViewMode(key, defaultMode) {
  const storageKey = `view_mode:${key}`
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return MODES.some(m => m.id === saved) ? saved : defaultMode
    } catch {
      return defaultMode
    }
  })

  useEffect(() => {
    try { localStorage.setItem(storageKey, mode) } catch {}
  }, [mode, storageKey])

  return [mode, setMode]
}

/** 큰 카드 / 작은 카드 / 목록 / 자세히 전환 버튼 */
export default function ViewModeToggle({ mode, onChange }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-xl p-0.5 flex-shrink-0">
      {MODES.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={label}
          aria-label={`${label} 보기`}
          aria-pressed={mode === id}
          className={`w-8 h-7 rounded-[10px] flex items-center justify-center transition-all ${
            mode === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}

/**
 * '자세히' 보기용 표. 칸이 많으면 표 안에서만 가로로 밀린다 (첫 칸은 고정).
 * columns: [{ label, render: row => 내용, className? }]
 */
export function DetailTable({ columns, rows, rowKey = r => r.id, onRowClick, rowClassName }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-[11px] whitespace-nowrap">
        <thead>
          <tr className="bg-gray-50 text-gray-400 font-black text-left">
            {columns.map((c, i) => (
              <th key={c.label} className={`px-3 py-2 ${i === 0 ? 'sticky left-0 bg-gray-50' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(row => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${onRowClick ? 'cursor-pointer active:bg-gray-50' : ''} ${rowClassName?.(row) || ''}`}
            >
              {columns.map((c, i) => (
                <td key={c.label} className={`px-3 py-2.5 text-gray-600 font-medium ${i === 0 ? 'sticky left-0 bg-white font-black text-gray-900' : ''} ${c.className || ''}`}>
                  {c.render(row) ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
