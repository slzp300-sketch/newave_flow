import { FileText, CheckSquare, UserCog, ShieldCheck } from 'lucide-react'

export const MENU_GROUPS = [
  {
    title: '회원 및 조직 관리',
    icon: UserCog,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '신규가입, 권한, 반 배정, 제적 관리',
    items: [
      { to: '/admin/pending-users', title: '가입 승인·이용 정지', desc: '신규 가입 승인과 정지 계정 확인' },
      { to: '/admin/teachers', title: '교사 권한 관리', desc: '일반/임원 교사 권한 부여 및 관리' },
      { to: '/admin/class-assignment', title: '반 담임/부담임 배정', desc: '가입된 교사를 학년/반에 배정' },
      { to: '/admin/students', title: '아이 관리', desc: '전체 아이 명단 및 반 배정 관리' },
      { to: '/admin/deactivation-requests', title: '제적 승인 관리', desc: '교사가 신청한 제적 요청 검토' },
    ]
  },
  {
    title: '모임 및 회의 관리',
    icon: FileText,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '기도모임, 교사회의, 회의록, 일정',
    items: [
      { to: '/admin/prayer', title: '기도모임 관리', desc: '불참 명단 및 필사 제출 현황' },
      { to: '/admin/meeting-attendance', title: '교사회의 관리', desc: '토요일 교사회의 참석 현황' },
      { to: '/admin/minutes', title: '회의록 관리', desc: '교사 회의록 작성 및 공개 설정' },
      { to: '/admin/calendar', title: '일정 관리', desc: '월별 부서 일정 등록 및 수정' },
    ]
  },
  {
    title: '출석 및 활동 관리',
    icon: CheckSquare,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '주간 출석, 행사 출석, TTS, 전도 관리',
    items: [
      { to: '/admin/student-attendance', title: '출석 관리', desc: '주차별 학년/반/학생 출석 현황 확인' },
      { to: '/admin/event-attendance', title: '행사 출석 관리', desc: '행사별 반 학생 출석 현황 확인' },
      { to: '/admin/tts', title: 'TTS 점검 관리', desc: '주간 TTS 질문 항목 및 제출 현황' },
      { to: '/admin/evangelism', title: '전도 관리', desc: '전도 조 편성 및 일정 관리' },
    ]
  },
  {
    title: '안전한 이용 관리', icon: ShieldCheck,
    color: 'text-primary-600', bg: 'bg-primary-50',
    desc: '신고와 사진 게시 검토',
    items: [
      { to: '/admin/content-reports', title: '신고 관리', desc: '신고 검토와 보호 조치' },
      { to: '/admin/content-photos', title: '사진 게시 검토', desc: '사진의 게시 승인·거절' },
    ],
  }
]

