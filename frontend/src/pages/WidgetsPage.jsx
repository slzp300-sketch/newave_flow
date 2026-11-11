import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import SegmentedControl from '../components/common/SegmentedControl'
import WidgetPreview from '../components/widgets/WidgetPreview'
import QueryNotice from '../components/common/QueryNotice'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import { hasQueryData } from '../utils/queryReadState'
import client from '../api/client'
import { isNativeApp, nativePlatform } from '../native/platform'
import { widgetController, widgetNative } from '../native/widgets'
import { WIDGET_TYPES, widgetType } from '../utils/widgetFamily'
import { CalendarDays, ListChecks, CircleCheck, PanelsTopLeft, Check } from 'lucide-react'

const icons = { daily: CircleCheck, weekly: ListChecks, combined: PanelsTopLeft, calendar: CalendarDays }

export default function WidgetsPage() {
  const navigate = useNavigate(), [size, setSize] = useState('medium'), [notice, setNotice] = useState('')
  const [type, setType] = useState('daily'), [adding, setAdding] = useState(false)
  const selected = widgetType(type), selectedSize = selected.sizes.includes(size) ? size : selected.sizes[0]
  const state = useSyncExternalStore(widgetController.subscribe, widgetController.getSnapshot)
  const query = useQuery({ queryKey: ['widget-preview'], queryFn: ({signal}) => client.get('/widgets/preview',{signal}).then(r=>r.data), staleTime:30_000 })
  const connect = async () => {
    setNotice(''); setAdding(true)
    try {
      if (!state.connected || state.error) await widgetController.reconnect()
      if (!widgetController.getSnapshot().connected) return
      if (nativePlatform === 'android') {
        const result = await widgetNative.pin({ type })
        setNotice(result.supported ? '홈 화면 추가 창에서 확인해주세요.' : `홈 화면 길게 누르기 → 위젯 → 뉴웨이브 · ${selected.title}`)
      } else setNotice(`홈 화면 길게 누르기 → 편집 → 위젯 추가 → 뉴웨이브에서 ‘${selected.title}’을 선택해주세요.`)
    } catch { setNotice(`홈 화면을 길게 눌러 ‘뉴웨이브 · ${selected.title}’을 추가해주세요.`) }
    finally { setAdding(false) }
  }
  return <><Header title="홈 화면 위젯" showBack/><div className="px-4 py-4 space-y-4">
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="위젯 종류">{WIDGET_TYPES.map(item => {
      const Icon = icons[item.id], active = item.id === type
      return <button type="button" key={item.id} aria-pressed={active} disabled={adding} onClick={() => { setType(item.id); setNotice('') }}
        className={`rounded-2xl border p-3 text-left transition-colors ${active ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700'}`}>
        <span className="flex items-center justify-between mb-2"><Icon size={20}/>{active && <Check size={16}/>}</span><strong className="block text-sm">{item.title}</strong><span className="block mt-1 text-xs text-gray-500">{item.description}</span>
      </button>
    })}</div>
    {selected.sizes.length > 1 ? <SegmentedControl label="위젯 크기" value={selectedSize} onChange={setSize} options={[{value:'medium',label:'중간 위젯'},{value:'large',label:'큰 위젯'}]}/> : <p className="text-xs text-gray-500">교회 달력은 큰 위젯으로 제공됩니다.</p>}
    <div className="flex items-center justify-between gap-2 text-xs"><strong className="shrink-0 whitespace-nowrap rounded-full bg-primary-50 px-3 py-1 text-primary-700">미리보기</strong><span className="text-gray-500">누르면 해당 화면으로 이동합니다.</span></div>
    {hasQueryData([query]) ? <div><WidgetPreview snapshot={query.data} type={type} compact={selectedSize==='medium'} onOpen={navigate}/><QueryRefreshNotice queries={[query]} label="위젯"/></div> : <QueryNotice queries={[query]} label="위젯"/>}
    <Card className="space-y-3"><p className="text-sm font-semibold">원하는 위젯을 여러 개 추가할 수 있어요.</p>
      <p className="text-xs text-gray-500">아이폰은 iOS 17 이상에서 사용할 수 있어요.</p>
      {isNativeApp ? <Button className="w-full" loading={state.busy || adding} onClick={connect}>{selected.title} 추가하기</Button> : <p className="text-sm text-gray-600">설치한 앱의 내 정보에서 위젯을 추가해주세요.</p>}
      {(notice||state.error)&&<p role="status" className="text-xs text-gray-600">{state.error||notice}</p>}
    </Card>
  </div></>
}
