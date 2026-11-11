import { FileText, CheckSquare, UserCog, ShieldCheck } from 'lucide-react'

export const MENU_GROUPS = [
  {
    title: '담당 업무', tone: 'violet', icon: FileText, color: 'text-primary-600', bg: 'bg-primary-50',
    items: [
      { to: '/grade-care', title: '우리 학년', desc: '학년 체크 현황·학생 돌봄' },
      { to: '/admin/weekly-report', title: '주간보고서 관리', desc: '자동 집계·보완·한글/PDF', capability: 'weeklyReport' },
      { to: '/new-family', title: '새가족팀 관리', desc: '첫 방문·출결·과정·등반·반 배정', capability: 'newFamily' },
      { to: '/praise', title: '찬양팀', desc: '명단·로테이션·콘티·기도회', capability: 'praise' },
      { to: '/intercession', title: '중보기도팀', desc: '모임·기도제목·공유 자료', capability: 'intercession' },
      { to: '/worship', title: '예배운영팀', desc: '예배위원·공지·준비', capability: 'worship' },
    ],
  },
  {
    title: '회원 및 조직 관리', tone: 'blue',
    icon: UserCog,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '신규가입, 권한, 반 배정, 제적 관리',
    items: [
      { to: '/officers', title: '임원 업무·조직도', desc: '직책·담당자·활동연도' },
      { to: '/admin/pending-users', title: '가입 승인·이용 정지', desc: '신규 가입 승인과 정지 계정 확인' },
      { to: '/admin/teachers', title: '교사 권한 관리', desc: '일반/임원 교사 권한 부여 및 관리' },
      { to: '/admin/class-assignment', title: '반 담임/부담임 배정', desc: '가입된 교사를 학년/반에 배정' },
      { to: '/admin/students', title: '아이 관리', desc: '전체 아이 명단 및 반 배정 관리' },
      { to: '/admin/deactivation-requests', title: '제적 승인 관리', desc: '교사가 신청한 제적 요청 검토' },
    ]
  },
  {
    title: '모임 및 회의 관리', tone: 'amber',
    icon: FileText,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '기도모임, 교사회의, 회의록, 일정',
    items: [
      { to: '/admin/prayer', title: '기도모임 관리', desc: '불참 명단·주간 참석률' },
      { to: '/admin/meeting-attendance', title: '교사회의 관리', desc: '토요일 교사회의 참석 현황' },
      { to: '/admin/minutes', title: '회의록 관리', desc: '교사 회의록 작성 및 공개 설정' },
      { to: '/admin/calendar', title: '일정 관리', desc: '월별 부서 일정 등록 및 수정' },
    ]
  },
  {
    title: '출석 및 활동 관리', tone: 'teal',
    icon: CheckSquare,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '주간 출석, 행사 출석, TTS, 전도 관리',
    items: [
      { to: '/admin/attendance', title: '교사·학생 출석 관리', desc: '학년별 출석·미제출·보완' },
      { to: '/admin/event-attendance', title: '행사 출석 관리', desc: '행사별 반 학생 출석 현황 확인' },
      { to: '/admin/tts', title: 'TTS 점검 관리', desc: '주간 TTS 질문 항목 및 제출 현황' },
      { to: '/admin/evangelism', title: '전도 관리', desc: '전도 조 편성 및 일정 관리' },
    ]
  },
  {
    title: '안전한 이용 관리', tone: 'slate', icon: ShieldCheck,
    color: 'text-primary-600', bg: 'bg-primary-50',
    desc: '신고와 사진 게시 검토',
    items: [
      { to: '/admin/content-reports', title: '신고 관리', desc: '신고 검토와 보호 조치' },
      { to: '/admin/content-photos', title: '사진 게시 검토', desc: '사진의 게시 승인·거절' },
    ],
  }
]

export const PERSONAL_GROUPS = [
  { title: '체크·참여', tone: 'teal', items: [
    { to: '/tts', title: 'TTS', task: 'tts', pending: '미체크' },
    { to: '/attendance', title: '주일 출석', task: 'attendance', pending: '미제출' },
    { to: '/event-attendance', title: '행사 출석', task: 'event', pending: '미제출' },
    { to: '/meeting/prayer', title: '기도모임', task: 'prayer', pending: '미응답' },
    { to: '/meeting/sat', title: '교사회의', task: 'meeting', pending: '미응답' },
  ] },
  { title: '기록·일정', tone: 'amber', items: [
    { to: '/minutes', title: '회의록·영상', task: 'minutes', pending: '미확인' },
    { to: '/evangelism', title: '전도 로테이션', task: 'rotation' },
    { to: '/calendar', title: '행사일정', task: 'schedule' },
  ] },
  { title: '학생·반', tone: 'blue', items: [
    { to: '/roster', title: '교적부' }, { to: '/class-manage', title: '반 관리' },
  ] },
]

export function managementMenuGroups(role, canManageNewFamily = false, canReport = false, canPraise = false, canIntercession = false, canWorship = false) {
  const canManageAll = ['ADMIN', 'PASTOR', 'EXECUTIVE'].includes(role)
  return MENU_GROUPS.map(group => ({ ...group, items: group.items.filter(item =>
    item.capability === 'newFamily' ? canManageNewFamily : item.capability === 'weeklyReport' ? canReport : item.capability === 'praise' ? canPraise : item.capability === 'intercession' ? canIntercession : item.capability === 'worship' ? canWorship : canManageAll
  ) })).filter(group => group.items.length > 0)
}

