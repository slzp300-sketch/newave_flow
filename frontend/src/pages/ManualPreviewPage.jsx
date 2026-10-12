import { useParams, Navigate, Link } from 'react-router-dom'
import { Printer, ChevronRight } from 'lucide-react'
import Brand from '../components/common/Brand'

const manuals = {
  teacher: {
    title: '교사용 이용 안내',
    sections: [
      { title: '홈에서 이번 주 확인하기', path: '/', text: '이번 주 TTS 점수, 우리 반 출석, 기도모임 투표와 교사회의 기록을 확인합니다. 전체 보기를 누르면 주간 체크 현황과 일정을 볼 수 있습니다.' },
      { title: '우리 반 출석 기록하기', path: '/attendance', text: '학생별 출석·불참을 선택하고 불참 사유와 특이사항을 입력한 뒤 제출합니다. 담임·부담임 중 한 분이 제출하면 우리 반이 함께 완료됩니다. 제출 후에도 수정할 수 있습니다.' },
      { title: 'TTS 체크와 분기 현황', path: '/tts', text: '요일별 항목을 누르면 바로 저장됩니다. 아직 오지 않은 요일은 체크할 수 없습니다. 이전 주 기록과 분기별 점수는 TTS 화면에서 확인하세요. 시트에서 옮긴 확정 총점은 읽기 전용이며, 기록 없음과 0점은 구분합니다.' },
      { title: '주간 체크 현황', path: '/checklist', text: '출석, TTS, 기도모임, 교사회의와 행사 등 이번 주 확인할 일을 모아 봅니다. 각 항목을 누르면 해당 기록 화면으로 이동합니다.' },
      { title: '모임과 행사', path: '/event-attendance', text: '기도모임 투표와 교사회의 체크는 전체 메뉴에서, 출석이 필요한 행사는 행사 출석 체크에서 기록합니다. 행사는 화면에 표시된 제출 기한과 참석 대상을 확인하세요.' },
      { title: '교적부와 반 관리', path: '/class-manage', text: '교적부에서 학생과 교사 정보를 조회하고, 반 관리에서 담당 학생의 정보와 메모를 확인합니다. 큰글씨 설정은 내 정보에서 바꿀 수 있습니다.' },
    ],
  },
  pastor: {
    title: '관리자용 이용 안내',
    sections: [
      { title: '관리 현황과 바로가기', path: '/', text: '홈에서 개인 TTS와 이번 주 할 일을 확인하고, 관리 요약에서 가입 대기·교사·일정을 확인합니다. 바로가기의 수정 버튼으로 자주 사용하는 메뉴를 정리할 수 있습니다.' },
      { title: '출석 현황 확인', path: '/admin/student-attendance', text: '주차별 반 출석과 제출 여부를 확인합니다. 출석 제출은 담임·부담임 개인별이 아닌 반 단위로 함께 완료됩니다.' },
      { title: 'TTS와 분기 점수', path: '/admin/tts', text: '주간 참여 현황, 분기 점수, 체크 항목을 관리합니다. 기록은 2026년 4분기부터 관리하며 다음 해에는 각 분기를 선택할 수 있습니다. 과거 확정 기록과 당시 배점은 보존됩니다.' },
      { title: '일정과 행사', path: '/admin/calendar', text: '행사를 등록할 때 날짜, 제출 기한, 참석 대상을 확인합니다. 행사 출석 현황의 명단은 당시 기준으로 보존됩니다.' },
      { title: '학생과 반 배정', path: '/admin/class-assignment', text: '교사와 학생의 반 배정을 확인하고 담당 교사를 관리합니다. 가입 승인, 권한, 제적 요청 등 다른 관리 기능은 전체 메뉴에서 확인할 수 있습니다.' },
    ],
  },
}

export default function ManualPreviewPage() {
  const { type } = useParams()
  const manual = manuals[type]
  if (!manual) return <Navigate to="/" />
  return (
    <article className="min-h-screen bg-white px-5 py-7 pb-28 print:p-0">
      <header className="border-b border-gray-200 pb-6">
        <Brand />
        <p className="text-xs tracking-widest text-gray-500 mt-7">NEWAVE FLOW GUIDE</p>
        <h1 className="text-2xl font-semibold mt-2">{manual.title}</h1>
        <p className="text-sm text-gray-500 leading-relaxed mt-3">뉴웨이브 청소년부의 기록을 함께 이어 갑니다.<br />각 항목에서 실제 화면으로 이동할 수 있습니다.</p>
      </header>
      <div className="divide-y divide-gray-200">
        {manual.sections.map((section, i) => (
          <section key={section.path} className="py-6 break-inside-avoid">
            <p className="text-xs font-medium text-primary-700 mb-2">{String(i + 1).padStart(2, '0')}</p>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed mt-3">{section.text}</p>
            <Link to={section.path} className="inline-flex items-center gap-1 min-h-11 text-sm text-primary-700 mt-2 print:hidden">화면 열기<ChevronRight size={16} /></Link>
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
