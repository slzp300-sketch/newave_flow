import { Link } from 'react-router-dom'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'

const EMAIL = 'slzp300@gmail.com'
const SUBJECT = encodeURIComponent('Newave Flow 계정 삭제 요청')
const BODY = encodeURIComponent('Newave Flow 계정과 개인정보 삭제를 요청합니다.\n\n가입한 이메일: \n이름: \n\n※ 비밀번호, 주민등록번호, 신분증 사진은 보내지 마세요.')

export default function AccountHelpPage({ deletion = false }) {
  return <div className="min-h-screen bg-surface max-w-mobile mx-auto pb-10">
    <Header title={deletion ? '계정 삭제 요청' : '고객지원'} showBack showNotification={false} onBack={() => window.history.length > 1 ? window.history.back() : window.location.assign('/login')} />
    <div className="px-4 py-6 space-y-4">
      <div><p className="text-primary-700 text-xs font-bold tracking-widest">NEWAVE FLOW</p>
        <h2 className="mt-2 text-xl font-bold">{deletion ? '탈퇴와 개인정보 삭제를 도와드려요' : '이용 중 도움이 필요하신가요?'}</h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">{deletion ? '앱을 지웠거나 로그인할 수 없어도 아래 이메일로 삭제를 요청할 수 있습니다.' : '로그인, 출석, 행사, 영성체크와 계정 관련 문의를 보내주세요.'}</p>
      </div>
      {deletion && <>
        <Card><h3 className="font-bold mb-3">삭제 요청 방법</h3>
          <ol className="list-decimal pl-5 text-sm leading-7 text-gray-700">
            <li>가능하면 가입한 이메일 주소로 요청해 주세요.</li>
            <li>담당자가 본인 여부와 삭제 범위를 확인합니다.</li>
            <li>처리 결과를 이메일로 안내합니다.</li>
          </ol>
          <p className="mt-3 text-sm text-gray-600">이메일을 작성한 뒤 직접 전송해야 요청이 접수됩니다. 버튼을 누르는 것만으로 계정이 삭제되지는 않습니다.</p>
        </Card>
        <Card><h3 className="font-bold mb-3">삭제되는 정보와 남는 기록</h3>
          <p className="text-sm leading-6 text-gray-700">계정의 로그인 정보, 이름·연락처·프로필, 개인 TTS 기록은 삭제 대상입니다. 반 공동 출석·보고서는 요청자를 식별할 수 없게 처리한 뒤 보존합니다.</p>
          <p className="mt-3 text-sm leading-6 text-gray-600">공동 문서와 과거 명단에 남은 개인정보도 확인합니다. 처리 일정과 백업에 남은 정보의 처리 방법은 본인 확인 후 안내합니다.</p>
        </Card>
      </>}
      <Card><h3 className="font-bold mb-2">운영 담당자에게 문의</h3>
        <p className="text-sm leading-6 text-gray-700">제자광성교회 뉴웨이브 청소년부</p>
        <a href={`mailto:${EMAIL}${deletion ? `?subject=${SUBJECT}&body=${BODY}` : ''}`} className="brand-action mt-3 flex min-h-12 items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold">
          {deletion ? '삭제 요청 이메일 작성' : '문의 이메일 작성'}
        </a>
        <p className="mt-3 text-sm break-all text-center text-gray-700">{EMAIL}</p>
        <p className="mt-2 text-xs leading-5 text-gray-500">메일 앱이 열리지 않으면 위 주소로 직접 보내주세요. 비밀번호·인증번호·신분증 사진은 보내지 마세요.</p>
      </Card>
      <Link className="block py-3 text-sm text-center text-primary-700 underline" to={deletion ? '/support' : '/account-deletion'}>{deletion ? '일반 문의 안내' : '회원 탈퇴·계정 삭제 안내'}</Link>
    </div>
  </div>
}
