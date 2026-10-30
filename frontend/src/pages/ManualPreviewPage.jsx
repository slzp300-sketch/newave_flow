import './SupportingReadability.css'
import { useParams, Navigate, Link } from 'react-router-dom'
import { Printer, ChevronRight } from 'lucide-react'
import Brand from '../components/common/Brand'

const manuals = {
  teacher: {
    title: '교사용 이용 안내',
    sections: [
      { title: '홈에서 메뉴와 미체크 확인하기', path: '/', text: '홈에서 업무 확인 · 빨간 점은 미완료 항목' },
      { title: '우리 반 출석 기록하기', path: '/attendance', text: '담당 학생 출석 체크 → 한 분만 제출 · 제출 후 수정 가능' },
      { title: 'TTS 체크와 분기 현황', path: '/tts', text: '체크 즉시 저장 · 미래 날짜 입력 불가 · 이전 기록·분기 점수 조회' },
      { title: '모임과 행사', path: '/event-attendance', text: '홈에서 기도모임·교사회의 체크 · 행사는 대상·제출 기한 확인' },
      { title: '교적부와 반 관리', path: '/class-manage', text: '교사·학생 정보와 반 메모 확인 · 큰글씨는 내 정보에서 설정' },
    ],
  },
  pastor: {
    title: '관리자용 이용 안내',
    sections: [
      { title: '관리 현황과 바로가기', path: '/admin', text: '홈의 관리 메뉴에서 가입·교사·일정 현황 확인' },
      { title: '출석 현황 확인', path: '/admin/student-attendance', text: '주차별 출석·제출 확인 · 반 단위 제출' },
      { title: 'TTS와 분기 점수', path: '/admin/tts', text: '주간 참여·분기 점수·항목 관리 · 과거 기록·배점 보존' },
      { title: '일정과 행사', path: '/admin/calendar', text: '일정·제출 기한·대상 설정 · 행사 당시 명단 보존' },
      { title: '학생과 반 배정', path: '/admin/class-assignment', text: '교사·학생 반 배정 관리 · 가입·권한·제적은 관리 메뉴' },
    ],
  },
}

export default function ManualPreviewPage() {
  const { type } = useParams()
  const manual = manuals[type]
  if (!manual) return <Navigate to="/" />
  return (
    <article className="supporting-readable readable-content min-h-screen bg-white px-5 py-7 pb-28 print:p-0">
      <header className="border-b border-gray-200 pb-6">
        <Brand />
        <p className="text-xs tracking-widest text-gray-500 mt-7">NEWAVE FLOW GUIDE</p>
        <h1 className="text-2xl font-semibold mt-2">{manual.title}</h1>
        <p className="text-sm text-gray-500 leading-relaxed mt-3">주요 업무 바로가기</p>
      </header>
      <div className="divide-y divide-gray-200">
        {manual.sections.map((section, i) => (
          <section key={section.path} className="py-6 break-inside-avoid">
            <p className="text-xs font-medium text-primary-700 mb-2">{String(i + 1).padStart(2, '0')}</p>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed mt-3">{section.text}</p>
            <Link to={section.path} className="brand-action inline-flex items-center gap-1 min-h-11 text-sm text-primary-700 mt-2 print:hidden">화면 열기<ChevronRight size={16} /></Link>
          </section>
        ))}
      </div>
      <button onClick={() => window.print()} className="min-h-11 w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 text-white px-4 py-3 text-sm font-semibold print:hidden">
        <Printer size={18} /> PDF로 저장 / 인쇄
      </button>
      <p className="text-xs text-gray-500 mt-6 text-center">NEWAVE · 뉴웨이브 청소년부</p>
    </article>
  )
}
