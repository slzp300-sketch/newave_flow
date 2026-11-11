import { Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export const FEATURE_GUIDE = [
  ['TTS · 주간 체크', '말씀·기도·예배 기록과 통계'],
  ['일정 · 행사 참석', '일정 조회와 교사·학생 참석 체크'],
  ['학생 출석 · 공동 보고', '담당 반 출석·사유 기록과 제출'],
  ['교사회의 · 기도모임', '참석 체크·회의록 확인·참석 통계'],
  ['회의록 · 전도 로테이션', '회의록·영상·전도 담당 일정 확인'],
  ['교적부 · 반관리', '학생 정보와 담당 반 관리'],
  ['내 정보 · 계정 연결 · 삭제', '프로필·로그인 연결·삭제 요청 (로그인 전에도 본인 확인 후 접수)'],
  ['이용수칙 · 신고 · 사진 검토', '신고·처리 상태 확인 · 사진은 관리자 승인 후 공개'],
  ['관리자 기능', '홈의 관리 메뉴에서 회원·조직·활동·안전 관리'],
]

export default function AppGuidePage() {
  const { user, apiEnvironment } = useAuthStore()
  return <main className="safe-page-top mx-auto min-h-screen max-w-mobile bg-white px-5 pb-12 text-gray-900">
    <Link to={user ? '/' : '/login'} className="inline-flex min-h-12 items-center font-semibold text-primary-700">{user ? '홈으로 돌아가기' : '로그인으로 돌아가기'}</Link>
    <h1 className="mt-3 text-2xl font-bold">앱 기능·계정 안내</h1>
    <p className="mt-3 text-sm leading-7">만 14세 이상 승인된 교사·사역 담당자용 무료 앱 · 학생·보호자 가입 불가</p>
    <section className="mt-6 rounded-xl bg-blue-50 p-4 text-sm leading-7">
      <h2 className="font-bold text-base">일반 계정과 가상 자료 계정</h2>
      <p>로그인 전 계정 종류 선택 · 가상 계정은 별도 서버의 가상 자료와 제공된 계정 사용</p>
      <p className="mt-2">역할별 메뉴 제공 · 역할 변경은 해당 계정으로 재로그인</p>
      <p className="mt-2">일반 계정: Apple(iPhone·iPad)·카카오 연결 가능, 가입 승인 필요. 가상 계정: 이메일 로그인 전용. 승인 대기 중에도 문의·삭제 요청 가능.</p>
      {user && <p className="mt-2 font-semibold">현재: {apiEnvironment === 'review' ? '가상 자료 계정' : '일반 계정'}</p>}
    </section>
    <section className="mt-6 space-y-4" aria-label="전체 기능">
      {FEATURE_GUIDE.map(([title, description]) => <article key={title} className="border-b border-gray-200 pb-4">
        <h2 className="font-bold text-base">{title}</h2><p className="mt-1 text-sm leading-7">{description}</p>
      </article>)}
    </section>
    <p className="mt-5 text-sm leading-7">기한·권한 규칙은 두 계정 동일 · 가상 자료도 저장되며 자동 초기화되지 않습니다. 새 자료는 관리자에게 요청하세요.</p>
    <div className="mt-4 flex flex-wrap gap-x-5 text-sm font-semibold text-primary-700"><Link className="min-h-11 py-3" to="/support">고객지원</Link><Link className="min-h-11 py-3" to="/account-deletion">계정 삭제 안내</Link><Link className="min-h-11 py-3" to="/privacy">개인정보처리방침</Link></div>
  </main>
}
