import { Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export const FEATURE_GUIDE = [
  ['TTS · 주간 체크', '말씀·기도와 예배 실천을 저장하고 주간·분기 통계를 확인합니다.'],
  ['일정 · 행사 참석', '달력과 행사 목록에서 일정을 보고, 본인과 담당 학생의 참석 여부를 기록합니다.'],
  ['학생 출석 · 공동 보고', '담당 반의 출석과 결석 사유를 작성하고 반 보고서를 제출합니다.'],
  ['교사회의 · 기도모임', '주차를 선택해 참석·불참을 기록합니다. 불참자는 회의록 확인이나 필사 제출을 확인할 수 있습니다.'],
  ['회의록 · 전도 로테이션', '회의 내용과 외부 영상 링크를 확인하고 전도 조·담당 일정·일정 상태를 조회합니다.'],
  ['교적부 · 반관리', '권한에 맞는 학생 정보와 담당 반을 조회·관리합니다.'],
  ['내 정보 · 계정 연결 · 삭제', '프로필을 관리하고 외부 로그인 계정을 연결합니다. 삭제 요청은 로그인 전에도 본인 확인 후 접수할 수 있습니다.'],
  ['이용수칙 · 신고 · 사진 검토', '콘텐츠와 사용자를 신고하고 처리 상태를 확인합니다. 새 사진은 관리자 승인 후 다른 사용자에게 표시됩니다.'],
  ['관리자 기능', '교사·학생·반 배정, 가입 승인·이용 정지, 일정·행사·회의·기도모임·회의록·전도·TTS·출석·신고·사진을 관리합니다. 관리자 권한 계정으로 홈의 관리 메뉴에서 접근합니다.'],
]

export default function AppGuidePage() {
  const { user, apiEnvironment } = useAuthStore()
  return <main className="safe-page-top mx-auto min-h-screen max-w-mobile bg-white px-5 pb-12 text-gray-900">
    <Link to={user ? '/' : '/login'} className="inline-flex min-h-12 items-center font-semibold text-primary-700">{user ? '홈으로 돌아가기' : '로그인으로 돌아가기'}</Link>
    <h1 className="mt-3 text-2xl font-bold">앱 기능·계정 안내</h1>
    <p className="mt-3 text-sm leading-7">뉴웨이브 플로우는 만 14세 이상 승인된 교사·사역 담당자를 위한 무료 업무 앱입니다. 학생·보호자는 앱 계정을 만들지 않습니다.</p>
    <section className="mt-6 rounded-xl bg-blue-50 p-4 text-sm leading-7">
      <h2 className="font-bold text-base">일반 계정과 가상 자료 계정</h2>
      <p>로그인 전에 계정 종류를 직접 선택합니다. 가상 계정은 실제 교사·학생 개인정보를 보호하기 위해 분리된 서버와 가상 자료를 사용하며, 같은 앱의 업무 화면과 권한 규칙으로 동작합니다. 제공된 교사·관리자 계정이 필요합니다.</p>
      <p className="mt-2">교사 계정은 담당 업무를, 관리자 계정은 관리 기능을 확인할 수 있습니다. 메뉴는 계정의 역할에 따라 다르며, 역할을 바꾸려면 로그아웃 후 해당 계정으로 로그인합니다.</p>
      <p className="mt-2">가상 계정에는 Apple·카카오 인증을 연결하지 않습니다. 실제 외부 인증은 일반 계정에서 진행합니다. iPhone·iPad 앱은 Apple 로그인을 지원합니다. 일반 서비스의 신규 가입에는 관리자 승인이 필요합니다. 승인 대기 중에는 고객지원으로 문의할 수 있고, 계정 삭제도 요청할 수 있습니다.</p>
      {user && <p className="mt-2 font-semibold">현재: {apiEnvironment === 'review' ? '가상 자료 계정' : '일반 계정'}</p>}
    </section>
    <section className="mt-6 space-y-4" aria-label="전체 기능">
      {FEATURE_GUIDE.map(([title, description]) => <article key={title} className="border-b border-gray-200 pb-4">
        <h2 className="font-bold text-base">{title}</h2><p className="mt-1 text-sm leading-7">{description}</p>
      </article>)}
    </section>
    <p className="mt-5 text-sm leading-7">일정·마감일·역할에 따른 제한은 두 계정 종류에 똑같이 적용됩니다. 과거 기록은 주차를 바꿔 확인할 수 있습니다. 가상 자료를 변경하면 저장되며, 자동으로 원래 상태로 되돌리지 않습니다. 새 검수 자료가 필요하면 관리자에게 요청해 주세요.</p>
    <div className="mt-4 flex flex-wrap gap-x-5 text-sm font-semibold text-primary-700"><Link className="min-h-11 py-3" to="/support">고객지원</Link><Link className="min-h-11 py-3" to="/account-deletion">계정 삭제 안내</Link><Link className="min-h-11 py-3" to="/privacy">개인정보처리방침</Link></div>
  </main>
}
