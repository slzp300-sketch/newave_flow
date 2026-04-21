import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { BookOpen, FileText, Download, Printer } from 'lucide-react';

const manuals = {
  teacher: {
    title: 'Newave Flow 일반 교사용 매뉴얼',
    sections: [
      {
        title: '1. 홈 화면 (대시보드)',
        content: '로그인 후 가장 먼저 만나는 화면입니다. 선생님의 이번 주 주요 일정과 수행해야 할 작업들을 한눈에 확인할 수 있습니다.',
        image: '/manual_images/dashboard_teacher.png'
      },
      {
        title: '2. 학생 출석 체크',
        content: '주일 예배 및 공과 공부 출석을 기록하는 화면입니다. 학생별로 출석, 지각, 결석 상태를 터치하여 선택하세요.',
        image: '/manual_images/attendance_teacher.png'
      },
      {
        title: '3. TTS (교사 훈련 시트) 제출',
        content: '선생님들의 개인 경건 생활과 성장을 기록하는 화면입니다. 매주 주어지는 질문에 답변하고 제출해 주세요.',
        image: '/manual_images/tts_teacher.png'
      },
      {
        title: '4. 주간 체크리스트',
        content: '결석 학생 연락, 주간 교안 준비 등 잊기 쉬운 행정 업무들을 하나씩 체크하며 관리할 수 있습니다.',
        image: '/manual_images/checklist_teacher.png'
      },
      {
        title: '5. 모음 및 기도회 출석',
        content: '교사 기도회나 정기 회의 출석을 보고하는 화면입니다.',
        image: '/manual_images/meeting_teacher.png'
      },
      {
        title: '6. 교적부 및 반 관리',
        content: '담당 반 학생들의 상세 정보를 확인하고 관리합니다. 비활성화 요청 등을 보낼 수 있습니다.',
        image: '/manual_images/roster_teacher.png'
      }
    ]
  },
  pastor: {
    title: 'Newave Flow 목사님/관리자용 매뉴얼',
    sections: [
      {
        title: '1. 관리자 대시보드',
        content: '부서의 전반적인 상태를 실시간으로 확인하는 대시보드입니다. 주간 출석 통계와 주요 수치를 한눈에 파악하세요.',
        image: '/manual_images/dashboard_pastor.png'
      },
      {
        title: '2. TTS 제출 현황 및 피드백',
        content: '교사들이 작성한 훈련 시트를 검토하고 평가나 격려의 피드백을 남길 수 있습니다.',
        image: '/manual_images/tts_pastor.png'
      },
      {
        title: '3. 교회 일정 및 행사 관리',
        content: '교회의 주요 일정과 특별 행사를 등록하고 관리합니다. 등록된 일정은 모든 교사의 캘린더에 동기화됩니다.',
        image: '/manual_images/calendar_pastor.png'
      },
      {
        title: '4. 관리 도구 및 메뉴',
        content: '교적부 관리, 전도 보고 현황, 비활성화 요청 처리 등 다양한 행정 도구를 활용하세요.',
        image: '/manual_images/admin_menu_pastor.png'
      },
      {
        title: '5. 학생 및 반 관리 상세',
        content: '특정 반의 담당 교사 배정, 학생 이동 및 반 구성을 세부적으로 조정할 수 있습니다.',
        image: '/manual_images/class_details_pastor.png'
      }
    ]
  }
};

export default function ManualPreviewPage() {
  const { type } = useParams();
  const manual = manuals[type];

  if (!manual) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto print:p-0">
      {/* Header */}
      <header className="border-b-2 border-blue-600 pb-6 mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{manual.title}</h1>
          <p className="text-blue-600 font-medium text-lg">Newave Flow 사역 지원 시스템</p>
        </div>
        <div className="text-right text-sm text-gray-500 print:hidden">
          <p>이 페이지를 인쇄(Ctrl+P)하여 PDF로 저장하세요.</p>
        </div>
      </header>

      {/* Intro section */}
      <section className="mb-12 bg-blue-50 p-6 rounded-2xl border border-blue-100">
        <div className="flex items-center gap-3 mb-3 text-blue-700">
          <BookOpen size={24} />
          <h2 className="text-xl font-bold">도움말 안내</h2>
        </div>
        <p className="text-gray-700 leading-relaxed">
          본 매뉴얼은 Newave Flow 시스템의 원활한 사용을 위해 제작되었습니다. 
          각 섹션의 안내를 따라 사역 업무를 효율적으로 관리하시기 바랍니다.
        </p>
      </section>

      {/* Main Content */}
      <div className="space-y-16">
        {manual.sections.map((section, index) => (
          <div key={index} className="break-inside-avoid">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-base">{index + 1}</span>
              {section.title.split('. ')[1] || section.title}
            </h3>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <p className="text-gray-600 text-lg leading-relaxed mb-4">
                  {section.content}
                </p>
              </div>
              <div className="w-full md:w-64 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm print:w-48">
                <img 
                  src={section.image} 
                  alt={section.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-20 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm italic">
        <p>© 2026 Newave Flow. All rights reserved. 본 문서는 시스템 관리 목적으로 배포되었습니다.</p>
      </footer>

      {/* Print Button (Visible only on screen) */}
      <button 
        onClick={() => window.print()}
        className="fixed bottom-8 right-8 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors print:hidden flex items-center gap-2 font-bold"
      >
        <Printer size={20} />
        PDF로 저장 / 인쇄
      </button>
    </div>
  );
}
