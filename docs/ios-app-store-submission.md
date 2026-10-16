# iOS App Store 제출 자료 초안

작성: 2026-10-15, 현황·공식 기준 갱신: 2026-10-16. 개인 멤버십·무료 앱 계약·앱 레코드·서명 설정과 TestFlight 1.0.0(2)의 Apple 처리·내부 검수 그룹 배포를 완료했다. 사용자 보고로 실제 iPhone의 Apple 인증 후 선택 화면 복귀, 기존 계정 연결·로그아웃·Apple 재로그인을 확인했다. **정식 심사·공개 출시는 미완료다.** 승인 대기·정지 계정의 공개 삭제 접수와 개인 작성 본문 처리 보완은 구현·합성 검증했으나 아직 배포 전이다. 만 14세 이상 승인 교사·담당자 정책·가입 코드를 구현·검증했으며, 개인정보 최종 게시·심사 접근·새 빌드 반영이 남아 있다. 대한민국만 무료·공개 배포와 수동 공개 설정은 콘솔 저장 기록이 있다. 실제 학생·교사 명단이나 비밀번호는 읽지 않았다. 상세 증거는 [최초 활성화 기록](ios-store/activation-checkpoint-2026-10-16.md)과 그 이후의 [Apple 로그인 기록](ios-store/apple-login-checkpoint-2026-10-16.md)을 따른다.

2026-10-15 소스 대조에서는 사진 사전 승인, 신고 담당·기한·보호 조치, 계정 정지·복구 및 관련 수집 이력을 반영했다. 이 기능의 구현·가상 회귀 검증과 시뮬레이터의 네이티브 시작 화면 검증은 실제 iPhone의 TestFlight 검수와 구분한다. 기능별 근거는 [콘텐츠 안전 검토](ios-content-safety-audit.md), 네이티브 검증 범위는 [iOS 개발](ios-development.md)을 따른다.

## 1. App Store Connect 기본 입력

| 항목 | 입력 초안 | 확정 조건 |
| --- | --- | --- |
| 기본 언어 | 한국어 | 앱 레코드에 저장 완료 |
| 앱 이름 | 뉴웨이브 플로우 | 앱 레코드에 저장 완료. 이름은 2~30자 |
| 부제 | 교사의 말씀·기도, 일정과 출석 관리 | 30자 이내 |
| 기본 카테고리 | 생산성(Productivity) | 콘솔 저장 완료. 보조 카테고리는 우선 비워 둠 |
| Bundle ID | `app.newaveflow.mobile` | Apple App ID·앱 레코드·서명 빌드 일치 확인 |
| SKU | `NEWAVEFLOW-IOS` | 앱 레코드에 저장 완료 |
| 버전 / 빌드 | `1.0.0` / `2` | 마지막으로 처리 완료한 TestFlight 빌드. 후속 코드 보완 시 새 빌드를 검증하고 제출 대상 교체 |
| 지원 기기 | iPhone, iOS 15.0 이상 | 현재 `TARGETED_DEVICE_FAMILY=1`과 deployment target 기준. 최종 Archive 재확인 |
| 가격 | 무료 — 사용자 확정 | 콘솔 대한민국 가격 ₩0.00 저장 확인. 결제·구독 기능 없음 |
| 배포 국가·방식 | 대한민국(KR)만, 공개 App Store 배포 — 사용자 확정 | 콘솔 저장 완료. 신규 국가 자동 추가 해제, 수동 공개, 앱 내 가입 승인 유지 |
| 지원 URL | `https://newave-flow.vercel.app/support` | 2026-10-15 공개 화면에서 로그인 없는 고객지원·문의·삭제 안내·방침 링크 확인 |
| 개인정보처리방침 URL | `https://newave-flow.vercel.app/privacy` | 2026-10-16 Apple 이메일·비밀번호 없는 가입·재인증 삭제 안내의 공개 배포 확인 |
| 개인정보 선택 URL(선택) | `https://newave-flow.vercel.app/account-deletion` | 2026-10-15 공개 화면에서 로그인 없는 삭제 범위·신청 방법·조회 코드 확인 경로·보조 문의 안내 확인 |
| 마케팅 URL(선택) | 공란 | 별도 소개 페이지가 준비되면 입력 |
| 공개 지원 이메일 | `slzp300@gmail.com` | 기존 공개 연락처와 동일 |
| 저작권 | `2026 김재현` | 사용자 확인에 따라 JSON·콘솔 저장 완료. 로고·교회 콘텐츠 권리자는 제자광성교회 청소년부 |
| 심사 담당자 | 사용자 제공 완료, 비공개 보관 | 최종 심사 연락란을 대조. 개인 전화·심사 이메일은 공개 저장소에 저장하지 않음 |

이름·부제 규격은 [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/), 설명·키워드·지원 URL·저작권·심사 연락란은 [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) 기준이다. 지원 URL은 실제 연락 방법을 제공하는 웹페이지여야 하며 이메일 주소 자체를 URL 대신 넣지 않는다.

### 설명 — 새 정책·가입 코드 배포 후 사용할 초안

```text
뉴웨이브 플로우는 제자광성교회 뉴웨이브 청소년부 교사를 위한 사역 관리 앱입니다.

매일의 말씀과 기도, 주간 일정, 반 출석과 행사 참석을 한곳에서 확인하고 기록하세요.

나의 영성체크
말씀과 기도 실천을 체크하고 주간 점수, 달성률과 요일별 기록을 확인합니다. TTS 상세 화면에서 주별 기록과 개인 통계를 살펴볼 수 있습니다.

일정과 주간 체크
달력과 주간 체크에서 이번 주 할 일을 확인합니다. 일정 확인 상태, 기도모임 응답과 교사회의 참여를 기록할 수 있습니다.

반 출석과 공동 보고
담당 반 학생의 출석을 기록하고 반 공동 출결보고를 작성합니다. 반과 학생 정보는 계정 권한에 따라 확인하고 관리합니다.

행사와 공동 업무
행사별 접수 기간에 맞춰 참석 여부를 기록하고, 회의록과 전도 일정을 확인합니다. 관리 권한이 있는 계정에는 해당 업무의 관리 기능이 제공됩니다.

안전한 이용
새 프로필 사진은 관리자 검토 후 게시됩니다. 문제가 있는 콘텐츠나 사용자를 신고하고 본인의 처리 결과를 확인할 수 있습니다.

이용 안내
만 14세 이상 교사·사역 담당자를 위한 앱입니다. 가입 후 관리자의 승인이 필요하며 인터넷에 연결되어 있어야 합니다. 학생과 보호자가 직접 이용하는 앱이 아닙니다.

앱의 고객지원과 계정 삭제 요청 화면에서 문의 및 권리 행사 방법을 확인할 수 있습니다.

운영: 제자광성교회 뉴웨이브 청소년부
문의: 앱의 고객지원 화면에서 문의 방법을 확인해 주세요.
```

설명은 일반 텍스트 4,000자 이내로 입력한다. 현재 초안에 Apple 로그인, 오프라인 저장, 푸시 알림, 즉시 자동 탈퇴를 지원한다고 적지 않았다. 앱의 '알림' 메뉴를 OS 푸시 알림이라고 소개하지 않는다.

기존 운영 방침·설명은 만 18세 이상이었다. 사용자는 18세 제한을 없애는 방향과 만 14세 미만 가입 불필요를 확인했고, 위 초안은 만 14세 이상 승인 교사·담당자로 정리한 새 정책안이다. 가입 코드·방침·스토어 문구의 최종 검증과 배포 전에 이미 공개 적용된 것으로 안내하지 않는다. 학생·보호자 직접 계정은 계속 제공하지 않는다.

### 키워드 — 붙여 넣을 초안

```text
교회출석,교사일정,기도기록,말씀체크,행사참석,사역관리
```

공식 문서의 한도는 **100바이트**다. 위 문자열은 UTF-8 77바이트이며 쉼표 뒤 공백을 넣지 않았다. 앱 이름이나 타사 상표를 반복하지 않는다. 프로모션 텍스트와 앱 미리보기 영상은 선택 항목이므로 최초 제출에서는 비워 둘 수 있다. 첫 버전에는 '이 버전의 새로운 기능' 입력란이 제공되지 않는다. [버전별 입력 규격](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)

## 2. 심사 접근과 Review Notes

**아래는 최종 iOS 빌드로 검증한 후 사용하는 초안이다.** 기존 Android 준비 문서는 온라인 가상 심사 환경의 로그인·저장·격리를 확인했다고 기록하지만, 그 기록이 iPhone 최종 빌드 검증을 대신하지 않는다.

| 비공개 심사 입력란 | 값 |
| --- | --- |
| 로그인 필요 | 예 |
| 사용자 이름 | `<가상 교사 ID>@review.newaveflow.invalid` |
| 비밀번호 | `<현재 유효한 가상 교사 비밀번호 — 비공개 입력>` |
| 추가 관리 계정 | `<가상 관리자 ID>@review.newaveflow.invalid` / `<관리자 비밀번호 — 비공개 입력>` |
| 삭제 검수용 계정 | `<삭제 전용 가상 ID>@review.newaveflow.invalid` / `<삭제 검수 비밀번호 — 비공개 입력>` |
| 내부 사전검증 대상 API | `https://newave-review-production.up.railway.app/api` |

실제 로그인값은 승인된 비밀 보관 위치에서 확인해 App Store Connect에 직접 입력한다. 이 문서의 placeholder는 작동하는 계정이 아니다. 제출 기간 동안 계정이 만료되지 않고 승인·OTP·추가 연락 없이 접근할 수 있어야 한다. 삭제 검수 계정은 별도 준비해 기본 교사·관리 계정이 삭제되어 심사가 막히지 않게 한다. 심사 정보는 공개 스토어 설명에 넣지 않는다. [완전한 심사 정보 제공](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review), [심사 로그인 정보](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)

### Review Notes — 검증 후 붙여 넣을 초안

```text
이 앱은 제자광성교회 뉴웨이브 청소년부의 만 14세 이상 승인된 교사·사역 담당자가 사용하는 업무 앱입니다. 학생·보호자는 앱 계정을 만들지 않습니다. 주요 기능은 말씀·기도 실천 기록, 일정, 학생 출석, 반 공동 보고와 행사 참석 관리입니다.

제공한 계정은 실제 회원·학생 자료와 분리된 가상 심사 환경으로 연결됩니다. 로그인 화면의 아이디 칸에 제공한 이메일 전체를 붙여 넣으세요. 도메인이 자동으로 직접입력으로 바뀌며 '가상 심사 환경' 안내가 표시됩니다. 이메일·비밀번호 로그인으로 주요 기능을 검토할 수 있습니다.

로그인 후 이용수칙 안내가 나오면 내용을 확인하고 진행하세요. 홈에서 말씀·기도 체크와 개인 통계, 하단 일정에서 달력, 전체 메뉴에서 출석·행사 출석 체크·회의록을 확인할 수 있습니다. 관리 기능은 아래 추가 계정으로 로그아웃 후 다시 로그인하여 검토해 주세요.

새 교사·학생 프로필 사진은 저장 후 검토 대기 상태가 되며, 승인 전에는 기존 승인 사진만 다른 사용자에게 표시됩니다. 관리자 계정에서 전체 → 관리 → 사진 게시 검토로 이동해 사진을 열고 승인·거절 및 처리 안내를 남길 수 있습니다.

전체 → 콘텐츠·사용자 신고에서 신고를 접수하고 본인 처리 내역을 확인할 수 있습니다. 관리자 계정의 전체 → 관리 → 신고 관리에서는 담당·긴급 여부를 설정하고 현재 대상을 확인한 뒤 메모·사진·회의록·일정 보호 조치 또는 사용자 이용 정지를 처리합니다. 가입 승인·이용 정지 메뉴에서 상태 이력을 확인하며, 정지 해제는 최종 관리자만 사유를 남겨 처리합니다.

추가 관리자와 삭제 검수 전용 계정의 유효한 로그인 정보는 비공개 심사 정보에 함께 제공합니다.

계정 삭제는 내 정보 또는 로그인 전 계정 삭제 요청 화면에서 신청합니다. 승인 대기·정지 상태도 이메일·현재 비밀번호 또는 새 Apple 인증으로 본인을 확인해 신청할 수 있습니다. 승인 상태를 해제하거나 일반 로그인 권한을 주는 기능은 아닙니다. 접수증으로 처리 상태를 확인하며, 신청 접수와 담당자의 실제 삭제 완료를 구분합니다.

TestFlight 1.0.0(2)는 Apple 로그인을 지원합니다. Apple 신규 가입은 검증된 이메일 또는 중계 주소를 사용하며 별도 앱 비밀번호를 요구하지 않습니다. 기존 회원은 내 정보에서 계정을 연결할 수 있습니다. 가상 심사 환경에서는 외부 Apple·카카오 인증을 제공하지 않으며 비공개로 제공한 이메일 계정으로 업무·관리 기능을 확인합니다. 실제 외부 인증의 심사 접근 경로는 별도로 안내해야 합니다.
```

Review Notes는 최대 4,000바이트다. 위 본문은 비공개 추가 계정 정보가 빠진 공개 보관용 초안이며, 공개 삭제 보완·새 정책을 포함한 후속 빌드 배포 후 사용한다. 콘솔에 넣을 때 유효한 추가 계정과 최종 인증 검토 경로를 합친 뒤 UTF-8 크기를 다시 확인한다. Apple 로그인은 운영 서버·빌드 2에서 활성화됐지만 가상 심사 서버는 Apple 키 설정을 허용하지 않는다. 이메일 가상 계정을 제공하는 것만으로 Apple 인증 전체를 검수할 수 있다고 적지 않는다. 공개 삭제·본문 처리 보완은 구현·합성 검증됐고, 실제 배포 및 외부 인증의 심사 접근 경로 확인 후 제출 문구를 확정한다. [Apple 로그인 연결 현황](ios-apple-sign-in.md)

### 심사자 동선과 제출 전 검증표

| 순서 | 실제 화면 동선 | 확인할 결과 | 현재 상태 |
| --- | --- | --- | --- |
| 1 | 최초 실행 → 로그인 | 시작 화면·키보드·안전 영역 정상 | 최종 iPhone 검증 필요 |
| 2 | 아이디에 가상 이메일 전체 입력 → 로그인 | 가상 환경 안내, 승인 대기 없이 진입 | 분기 코드 확인, iOS 검증 필요 |
| 3 | 이용수칙 동의 → 홈 말씀·기도 체크 → 개인 통계 | 저장 결과와 주간 합계 반영 | 기능 코드 확인 |
| 4 | 하단 일정 / 전체 → 출석 | 일정 확인, 가상 반 출석·공동 보고 저장 | 기능 코드 확인 |
| 5 | 전체 → 행사 출석 체크 | 접수 중 행사 저장, 마감 행사 조회 | 심사일 기준 접수 중 가상 행사 준비 필요 |
| 6 | 전체 → 회의록 및 영상 | 회의록·확인 상태, 외부 자료 열기 | 최종 콘텐츠·링크 검증 필요 |
| 7 | 전체 → 콘텐츠·사용자 신고 / 이용수칙 | 신고 접수·본인 내역 확인 | 기능 코드 확인, iPhone 검증 필요 |
| 8 | 내 정보 → 사진 선택·저장 → 사진 상태 / 로그아웃 → 재로그인 | 새 사진은 검토 대기, 다른 사용자에게 승인 전 미노출, 이전 승인 사진 유지·후보 삭제, 로그인 상태·자료 분리 | 서버·화면 구현 및 가상 회귀 확인. iPhone 사진 권한·재시작 검증 필요 |
| 9 | 관리자 계정 → 전체 → 관리 → 사진 게시 검토 / 신고 관리 / 가입 승인·이용 정지 | 사진 확인·승인·거절, 신고 담당·긴급·목표시간, 대상별 실제 보호 조치, 정지 이력·최종 관리자 복구 | 기능·권한·가상 회귀 확인. 최종 iPhone에서 계정 전환과 전체 동선 검증 필요 |
| 10 | 삭제 전용 계정 → 내 정보 → 회원 탈퇴·계정 삭제 요청 | 접수증 저장·로그아웃·비로그인 조회·실제 처리 완료 | 가상 자료로 전 과정 검증 필요 |

가입·승인 제한은 실제 서비스의 접근 조건이며 심사에서 숨기지 않는다. 리뷰 데이터만 가상으로 대체하고 기능을 심사 기간에만 바꾸지 않는다. 운영 계정이나 실제 학생 자료를 심사에 제공하지 않는다.

2026-10-16 추가 확인: 사용자 보고로 빌드 2의 Apple 인증·기존 계정 연결·재로그인은 성공했다. 위 업무·관리·삭제 동선 전체의 통과를 뜻하지 않는다. 승인 대기·정지·비활성 계정의 로그인 없는 본인 확인·삭제 접수는 구현·합성 검증 완료, 배포 전이다. 개인 작성 본문은 대상 개인 메모 삭제, 과거 익명 메모·작성자 없는 공동 문서의 명시적 귀속 결정, 부분 삭제와 복원 감사까지 보완했다. 백엔드 전체 검사 169개 중 157개 통과·선택 PG 12개 건너뜀, 별도 실제 PostgreSQL `PrivacyDeletionTest` 1/1·Node 8/8 통과다. 만 14세 이상 가입 확인을 포함한 11:39 KST 최신 검증이며 프론트 검사도 109개 통과했다. 배포 성공을 뜻하지 않는다. 실제 운영 삭제나 iPhone의 Apple 신규 가입·삭제·철회 검수는 실시하지 않았다. [계정 삭제 운영 절차](account-deletion-runbook.md), [Apple 삭제 기준](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion). 두 번째 iPhone 또는 다른 개인 Apple 계정 확보는 Apple의 필수 제출 절차가 아니다.

신고 관리의 일반 24시간·긴급 4시간은 운영자가 우선 확인할 내부 목표다. 실제 응답 시간이나 외부 푸시·메일 알림을 보장하는 문구로 옮기지 않는다. 사진 승인 전 미노출과 계정 정지는 서버에서도 적용되지만, 최종 iPhone에서 표시·권한·처리 결과가 일치하는지는 별도 검수한다.

## 3. App Privacy 입력 준비

현재 코드에 맞춘 선택값과 근거는 [개인정보·연령·암호화 제출 근거](ios-submission-evidence.md)에 정리했다. **수집함: 예, 목적: App Functionality, 사용자 연결: 예, 추적: 아니오**의 15개 유형 초안을 사용자 승인 후 App Store Connect에 저장했다. 최종 게시와 정확성 확인은 아직 완료하지 않았다.

선택할 데이터 유형은 Name, Email Address, Phone Number, Physical Address, Health, Sensitive Info, Contacts, Photos or Videos, Customer Support, Other User Content, User ID, Product Interaction, Performance Data, Other Diagnostic Data, Other Data Types다. 계정 없는 학생·보호자, 사진 승인 전 후보, 사진 검토·신고·정지 이력, 삭제 접수·조회 코드 해시도 범위에 포함한다.

- Health는 출결 사유의 현재 `몸살` 예시가 건강상태 입력을 직접 유도하므로 포함한다. 일반 자유 기록만을 이유로 포함한 것이 아니다.
- Contacts는 수동 교사·학생·보호자 목록과 관계를 저장하기 때문이다. 단말 주소록 권한은 요청하지 않는다.
- Customer Support는 앱 내 신고·삭제 요청 및 처리 내역을 포함한다. 해당 기능에 선택 공개 예외를 적용하지 않는다.
- 카카오 회원번호만 계정에 저장하지만 필드 제한 없는 인증 응답을 일시 처리하므로 프로필·이메일을 네트워크로 전혀 받지 않는다고 설명하지 않는다. 공개 방침 문구를 실제 처리에 맞게 정정했다.
- Railway 접속 IP·경로·상태·요청/응답 시간은 서비스 기능·보안·진단 목적의 로그다. 위치나 기기 추적 ID로 자동 분류하지 않는다.
- Apple 로그인은 운영 서버·TestFlight 빌드 2에서 활성화됐다. 검증된 이메일·중계 주소는 Email Address, 이름은 Name, Apple 식별자는 User ID, 연결·알림 상태는 Other Data Types의 기존 범위에 포함한다. [개인정보 안내 반영 기록](ios-apple-privacy-addendum.md)을 최종 신고와 대조한다.

로컬 `PrivacyInfo.xcprivacy`는 App Store Connect의 개인정보 라벨을 대신하지 않는다. 민감정보·학생 자료의 별도 동의·대리인 확인·국외 이전 절차는 실제 운영에서 이행해야 하며, 방침 공개나 성인 대상이라는 사실만으로 완료된 것으로 보지 않는다. [Apple 개인정보 신고 기준](https://developer.apple.com/app-store/app-privacy-details/)

현재 방침 원본은 `frontend/src/content/privacyPolicy.js`, 시행일은 `2026-10-16`, `publicationReady=true`다. 정적 공개 HTML은 `frontend/tools/build-privacy-policy.mjs`가 만든다. 2026-10-15에는 로그인 없이 지원·방침·삭제 안내를 확인했고, 2026-10-16에는 Apple 처리 안내를 포함한 공개 방침 배포를 확인했다. iPhone 삭제 전 과정과 후속 보완의 공개 문구 대조는 아직 남았다. 실제 권리 행사 신청이나 외부 메일 발송은 이 문서 조사에서 수행하지 않았다.

## 4. 연령·암호화 질문 준비

[제출 근거의 연령 표](ios-submission-evidence.md#2-연령-설문-답변)에 실제 기능별 응답을 마련했다. UGC와 Messaging and Chat은 예다. 공동 게시 외에도 관리자 작성 신고·사진 처리 안내를 신청자에게 직접 전달하는 경로를 확인했다. Contests는 주간·분기 TTS 점수순 순위의 상시 제공을 공식 정의와 대조해 초기 None에서 Frequent로 정정한 입력안이다. 상금 없는 순위도 제외되지 않는다는 소스 기반 해석이며 Apple 개별 확인 결과는 아니다. 소셜 미디어·제한 없는 웹 접근·광고·부모 통제·연령 검증은 아니오로 준비한다. 별도 실시간 채팅은 없으며 관리자의 가입 승인·나이 자기 확인은 연령 검증이 아니다. Health 수집 신고와 달리 진단·치료·웰니스 조언 기능은 제공하지 않는다.

사용자가 제공하지 않는다고 확인한 유해 표현은 해당 빈도를 None으로 신고했다. 과거 등급 보류와 만18세 운영 문구는 이전 기록이며, 현재 소스는 만14세 이상 승인 교사·담당자의 가입 확인을 구현·검증한 배포 전 상태다. 사용자가 글로벌16+ 저장을 승인한 뒤 콘솔 설문을 저장했다. UGC=Yes·Messaging and Chat=Yes·Contests=Frequent에 따른 자동13+를 글로벌16+로 상향했고, 글로벌16+ 173개 지역·대한민국15+를 확인했다. OS26 미만 글로벌 표시는17+이며 지역 예외가 있다. 가입 조건14세와 스토어 표시·설치 연령을 동일하게 안내하지 않는다. 저장 증거는 `.verification/ios-age-rating-saved-20261016.png`이며 정식 심사 승인이나 새 코드 배포를 뜻하지 않는다. [Apple 연령 정의](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/), [연령 설정](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)

로컬 텍스트 검사·사진 승인·신고 담당/긴급/목표시간·대상별 보호 조치·정지·복구는 구현되어 있다. 개인별 차단 목록은 없다. 자동 검증은 운영 검토·최종 iPhone 검수나 Apple의 UGC 요건 승인을 대신하지 않는다.

현재 iOS의 암호화는 OS 제공 HTTPS·Keychain·WebCrypto에 한정되며 **`ITSAppUsesNonExemptEncryption=false`**로 준비한다. ‘암호화를 사용하지 않는다’라는 답변이 아니다. 별도 암호화 서류 불요 판단과 최종 Archive 재검증 근거는 [암호화 입력안](ios-submission-evidence.md#3-수출-규정암호화)에 있다. [Apple 암호화 서류 기준](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/)

## 5. 화면 자료 준비

현재 iPhone 전용 설정을 유지한다면 iPhone 크기로 준비한다. 2026-10-15 다시 열람한 공식 표는 필수 iPhone 크기를 **Dynamic Island 중형**으로 표시하며 허용 세로 규격은 1179×2556 또는 1206×2622px다. 작업 기준은 **1206×2622px**로 갱신했다. 보조 대형 화면에는 1320×2868px 등 공식 허용 규격을 쓸 수 있다. 크기별 1~10장, PNG/JPEG, 알파·투명도 없는 파일을 사용하고 제출 직전 콘솔과 공식 표를 다시 확인한다. iPad 지원을 추가하면 iPad 요구도 적용한다. [스크린샷 규격](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

| 순서 | 화면 후보 | 가상 자료와 강조 내용 |
| --- | --- | --- |
| 1 | 홈 | 오늘의 말씀·기도 체크, 주간 점수 |
| 2 | TTS 개인 통계 | 주별 기록과 달성률 |
| 3 | 일정 | 현재 월의 가상 일정 |
| 4 | 출석 | 가상 반 학생 출결과 공동 보고 |
| 5 | 행사 출석 체크 | 접수 중인 가상 행사 참석 선택 |

최종 iOS 빌드의 실제 시뮬레이터 또는 iPhone 화면으로 촬영하고, 같은 빌드에서 사용자가 볼 수 있는 기능을 보여준다. 기존 Android/웹 화면을 확대해 iOS 최종 화면으로 제출하지 않는다. 실제 인물의 이름·전화번호·사진·로그인 비밀번호가 보이는 화면을 사용하지 않는다. 별도 `iOS synthetic store screenshots` workflow가 실제 Release 앱의 다섯 화면을 새로운 가상 자료로 촬영한다. 촬영 코드와 자료는 테스트 번들에만 있고, HTTP(S) 연결·등록되지 않은 응답·쓰기 요청은 차단한다. 성공 실행의 `ios-store-screenshots` 산출물과 `capture-receipt.json`에서 커밋·기기·원본 규격을 확인한다. 촬영 자동화가 존재한다는 것만으로 성공·외관 검수·스토어 업로드 완료를 뜻하지 않으며, 완료 증거는 해당 실행과 작업로그에 기록한다. **실제 iPhone 촬영과 스토어 업로드는 별도 단계다.**

서명된 빌드의 수동 생성·선택 업로드 경로와 비밀값 격리, iPhone 검수 흐름 및 원본 캡처 절차는 [TestFlight 운영 절차](ios-testflight-runbook.md)를 따른다. 2026-10-16 가상 자료로 촬영한 네이티브 스크린샷 5장의 형식·체크섬·촬영 영수증을 확인해 콘솔에 업로드했고 최종 빌드와의 대조는 남았다. 비로그인 시작 화면만을 이 다섯 장의 증거로 사용하지 않는다. 접근성 라벨은 현재 공식 안내상 자율 신고 단계이며 VoiceOver·큰 글자 등 실제로 검증한 항목만 선택한다. [접근성 표시 개요](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/)

## 6. 미완료 관문과 제출 자료

| 관문 | 현재 상태 | 완료 증거 |
| --- | --- | --- |
| 개발자 가입·제출 명의 | 개인 멤버십·무료 앱 계약 활성화 확인 | 앱 제출 명의 적합성은 아래 별도 검토 |
| 민감정보 앱의 제출 주체 | 개인 가입 가능 여부와 이 앱 심사 적합성은 별개 | 5.1.1(ix)에 따른 서비스 제공 주체·계정 유형 검토. 개인 가입 승인만으로 앱 적합성이 확인되지 않음 |
| Bundle ID·서명·배포 | 앱 등록·실제 서명·빌드 2 업로드/Apple 처리 완료 | 후속 코드 변경 시 새 Archive·빌드 검증 |
| Apple/카카오 로그인·Apple 서버 알림 | Apple 운영 활성화·V011/V014 적용·빌드 2 배포, 사용자 보고로 Apple 인증·연결·재로그인 확인 | 신규 가입·중계 이메일·취소·실제 철회 알림·삭제 및 카카오 최종 동선은 별도 검수 |
| 최종 iPhone 기능 검수 | Windows 구조·기존 자동 검증과 별도 | 위 심사 동선, 사진 권한, 키보드·안전 영역, 재시작·외부 인증·삭제 결과 |
| 심사 계정·가상 자료 | 기존 온라인 심사 환경 있음, iOS 최종 접근 미확인 | 유효한 교사·관리·삭제 전용 계정, 현재 접수 중 행사, 실제 자료 격리 |
| 정책·App Privacy·등급 | 기존 만 18세 운영 문구·개인정보 15유형 초안 저장. 새 만 14세 이상 승인 교사 정책·가입 코드 구현·검증 완료, 배포 전 | 새 정책 코드 배포·개인정보 게시. 사용자 승인 후 글로벌16+/대한민국15+ 콘솔 저장 완료 |
| 화면·아이콘·메타데이터 | 공개 JSON과 네이티브 스크린샷 5장 콘솔 업로드 완료 | 최종 서명 빌드와 화면 대조, 비공개 심사 정보·외부 인증 접근 경로 확정 |
| 수출 규정·권리·배포 방식 | 빌드 2의 면제 설정·서명 검사, 권리자/콘텐츠 권리·KR 무료·수동 공개·한국 연락처 저장 확인 | 제출 직전 실제 콘솔 값과 최종 빌드 재대조 |
| 계정 삭제 | 승인 대기·정지 계정의 공개 본인 확인 접수, 개인 메모·공동 본문 처리·복원 감사 구현·합성 검증 완료 | 후속 코드 배포, 실제 미확인 삭제·철회 결과와 공개 문구 검수 |
| TestFlight·정식 심사 | 빌드 2 처리·내부 배포 및 핵심 Apple 기기 흐름 확인, 정식 제출·공개 미완료 | 잔여 항목 완료 후 최종 빌드 선택·정식 심사·수동 공개 |

학생별 종교 활동을 기록하는 앱에는 [심사 지침 5.1.1(ix)](https://developer.apple.com/kr/app-store/review/guidelines/#data-collection-and-storage)의 민감정보 앱 제출 주체 규정이 관련될 수 있다. 개인 명의로 가입할 수 있다는 사실과 현재 앱을 개인 명의로 심사받을 수 있는지는 따로 확인한다. 이 문서는 법인 정보·개인 판매자 이름·전화번호·사업자 정보를 추정해 채우지 않는다.

기계 입력용 공개 자료는 [한국어 메타데이터 JSON](ios-store/metadata.ko-KR.json), 신고 근거는 [제출 근거](ios-submission-evidence.md)에 있다. JSON에는 비공개 심사 연락처·비밀번호를 넣지 않는다. 저작권 `2026 김재현`은 사용자 확인을 반영했다. 검사에서 메타데이터가 유효해도 정식 제출 완료로 표시하지 않는다.

콘솔에 Digital Goods and Services 설문이 표시되면 실제 제공·결제 방식에 맞춰 답변한다. 표시되지 않으면 조치가 필요 없다. 무료라는 사실만으로 디지털 기능 제공 여부를 추정하지 않는다. 최종 빌드와 필수 정보를 저장한 뒤 `Add for Review`와 실제 `Submit for Review`를 구분하며, 심사 승인 후에도 기존 수동 공개 설정을 유지한다. [추가 설문](https://developer.apple.com/help/app-store-connect/manage-app-information/complete-the-digital-goods-and-services-questionnaire), [정식 제출](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)

## 7. 조사 근거와 검증 범위

- 기능·이동: `frontend/src/pages/Login.jsx`, `MenuPage.jsx`, `ProfilePage.jsx`, `AccountHelpPage.jsx`, `frontend/src/components/layout/BottomNav.jsx`, `frontend/src/router/index.jsx`.
- 심사 분기: `frontend/src/auth/reviewEnvironment.js`, `frontend/src/api/auth.js`, `frontend/src/components/common/EmailInput.jsx`, [기존 심사 준비](android-store/review-instructions.md).
- 데이터 구조: `backend/src/main/java/com/newaveflow/entity/`의 `User.java`, `Student.java`, `StudentMemo.java`와 관련 출석·TTS·신고 엔티티. 실제 DB·명단·백업·비밀값을 읽지 않음.
- 안전 기능·처리 이력: `PhotoModerationService.java`, `ModeratedPhoto.java`, `ContentReport.java`, `UserStatusEvent.java`, `AccountDeletionRequest.java`, `frontend/src/pages/ContentPhotosAdminPage.jsx`, `ContentReportsAdminPage.jsx`, `AdminPendingUsersPage.jsx`, `frontend/src/components/common/PhotoReviewStatus.jsx`. 건강 입력 안내는 `frontend/src/pages/AttendancePage.jsx`·`ClassManagePage.jsx`를 대조했다.
- 개인정보: `frontend/src/content/privacyPolicy.js`, [기존 데이터 조사](android-store/data-safety-draft.md). 과거 Android 자료의 '방침 없음/미공개' 상태는 현재 원본과 달라 그대로 사용하지 않음.
- iOS 설정: `frontend/ios/App/App.xcodeproj/project.pbxproj`, [iOS 개발](ios-development.md), [Apple 로그인](ios-apple-sign-in.md).
- 실행 범위: 코드·문서와 Apple 공식 요구사항 조사, 제출 초안 작성·문구 길이 확인. 실제 가입·결제·계정 변경·심사 제출·업로드·운영 데이터 변경 없음.
