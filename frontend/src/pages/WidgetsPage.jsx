import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import SegmentedControl from '../components/common/SegmentedControl'
import WidgetPreview from '../components/widgets/WidgetPreview'
import client from '../api/client'
import { isNativeApp, nativePlatform } from '../native/platform'
import { widgetController, widgetNative } from '../native/widgets'

export default function WidgetsPage() {
  const navigate = useNavigate(), [size, setSize] = useState('large'), [notice, setNotice] = useState('')
  const state = useSyncExternalStore(widgetController.subscribe, widgetController.getSnapshot)
  const query = useQuery({ queryKey: ['widget-preview'], queryFn: ({signal}) => client.get('/widgets/preview',{signal}).then(r=>r.data), staleTime:30_000 })
  const connect = async () => {
    setNotice(''); await widgetController.reconnect()
    if (!widgetController.getSnapshot().connected) return
    if (nativePlatform === 'android') {
      try { const result = await widgetNative.pin(); if (!result.supported) setNotice('홈 화면을 길게 눌러 위젯에서 뉴웨이브를 선택해주세요.') }
      catch { setNotice('홈 화면을 길게 눌러 위젯에서 뉴웨이브를 선택해주세요.') }
    } else setNotice('홈 화면 길게 누르기 → 편집 → 위젯 추가 → 뉴웨이브')
  }
  return <><Header title="홈 화면 위젯" showBack/><div className="px-4 py-4 space-y-4">
    <SegmentedControl label="위젯 크기" value={size} onChange={setSize} options={[{value:'large',label:'큰 위젯'},{value:'medium',label:'중간 위젯'}]}/>
    {query.data ? <WidgetPreview snapshot={query.data} compact={size==='medium'} onOpen={navigate}/> : <Card><p role="status" className="text-sm text-gray-500">{query.isError?'위젯 내용을 불러오지 못했어요.':'위젯을 불러오는 중…'}</p>{query.isError&&<Button variant="secondary" onClick={()=>query.refetch()}>다시 확인</Button>}</Card>}
    <Card className="space-y-3"><p className="text-sm font-semibold">영성은 바로 체크 · 주간 항목은 앱에서</p>
      <p className="text-xs text-gray-500">아이폰은 iOS 17 이상에서 사용할 수 있어요.</p>
      {isNativeApp ? <Button className="w-full" loading={state.busy} onClick={connect}>홈 화면에 추가</Button> : <p className="text-sm text-gray-600">설치한 앱의 내 정보에서 위젯을 추가해주세요.</p>}
      {(notice||state.error)&&<p role="status" className="text-xs text-gray-600">{state.error||notice}</p>}
    </Card>
  </div></>
}
