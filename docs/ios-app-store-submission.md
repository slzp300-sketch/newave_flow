# iOS App Store 제출 자료 초안

작성·공식 기준 확인: 2026-10-15. **현재 확인된 사용자 상태는 개인 개발자 가입 대기이며, 유료 결제·계정 활성화 여부는 미확인이다. 개인 명의 제출 적합성 확인, App Store Connect 앱 생성, TestFlight 업로드 및 심사 제출도 완료된 것으로 확인하지 않았다.** 아래 문구와 개인정보·연령·암호화 입력안은 현재 코드에 맞춰 준비했다. 대한민국 한정 무료 공개 배포는 사용자 확인을 받았으며 실제 스토어 설정은 계정 활성화 후 적용한다. 실제 학생·교사 명단이나 비밀번호를 확인하지 않았다.

2026-10-15 소스 대조에서는 사진 사전 승인, 신고 담당·기한·보호 조치, 계정 정지·복구 및 관련 수집 이력을 반영했다. 이 기능의 구현·가상 회귀 검증과 시뮬레이터의 네이티브 시작 화면 검증은 실제 iPhone의 TestFlight 검수와 구분한다. 기능별 근거는 [콘텐츠 안전 검토](ios-content-safety-audit.md), 네이티브 검증 범위는 [iOS 개발](ios-development.md)을 따른다.

## 1. App Store Connect 기본 입력

| 항목 | 입력 초안 | 확정 조건 |
| --- | --- | --- |
| 기본 언어 | 한국어 | 앱 생성 시 선택 |
| 앱 이름 | 뉴웨이브 플로우 | 이름 사용 가능 여부 확인. 이름은 2~30자 |
| 부제 | 교사의 말씀·기도, 일정과 출석 관리 | 30자 이내 |
| 기본 카테고리 | 생산성(Productivity) | iOS 등록 시 최종 선택. 보조 카테고리는 우선 비워 둠 |
| Bundle ID | `app.newaveflow.mobile` | 현재 Xcode 프로젝트 값. Apple 계정 등록 가능 여부 미확인 |
| SKU | `NEWAVEFLOW-IOS` | 내부 관리용 제안. 계정 내 중복 확인 후 입력 |
| 버전 / 빌드 | `1.0.0` / `1` | 현재 Xcode 값. 실제 업로드 빌드와 일치시킬 것 |
| 지원 기기 | iPhone, iOS 15.0 이상 | 현재 `TARGETED_DEVICE_FAMILY=1`과 deployment target 기준. 최종 Archive 재확인 |
| 가격 | 무료 — 사용자 확정 | 현재 앱에 결제·구독 기능 없음. 스토어 판매 설정은 계정 활성화 후 입력 |
| 배포 국가·방식 | 대한민국(KR)만, 공개 App Store 배포 — 사용자 확정 | 신규 국가 자동 추가 안 함. 앱 내 가입 승인 유지. 실제 콘솔 설정은 미입력 |
| 지원 URL | `https://newave-flow.vercel.app/support` | 2026-10-15 공개 화면에서 로그인 없는 고객지원·문의·삭제 안내·방침 링크 확인 |
| 개인정보처리방침 URL | `https://newave-flow.vercel.app/privacy` | 2026-10-15 앱 제공 업데이트 적용 후 최신 시행일·접수증·신고 보관 안내 확인 |
| 개인정보 선택 URL(선택) | `https://newave-flow.vercel.app/account-deletion` | 2026-10-15 공개 화면에서 로그인 없는 삭제 범위·신청 방법·조회 코드 확인 경로·보조 문의 안내 확인 |
| 마케팅 URL(선택) | 공란 | 별도 소개 페이지가 준비되면 입력 |
| 공개 지원 이메일 | `slzp300@gmail.com` | 기존 공개 연락처와 동일 |
| 저작권 | `2026 <실제 저작권 보유자>` | 개인/교회 중 권리 보유자를 확인. 판매자 명의와 같다고 가정하지 않음 |
| 심사 담당자 | 사용자 제공 완료, 비공개 보관 | 계정 활성화 뒤 비공개 심사 연락란에 입력. 개인 성명·전화·심사 이메일은 공개 저장소에 저장하지 않음 |

이름·부제 규격은 [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/), 설명·키워드·지원 URL·저작권·심사 연락란은 [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) 기준이다. 지원 URL은 실제 연락 방법을 제공하는 웹페이지여야 하며 이메일 주소 자체를 URL 대신 넣지 않는다.

### 설명 — 붙여 넣을 초안

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
만 18세 이상 교사·사역 담당자를 위한 앱입니다. 가입 후 관리자의 승인이 필요하며 인터넷에 연결되어 있어야 합니다. 학생과 보호자가 직접 이용하는 앱이 아닙니다.

앱의 고객지원과 계정 삭제 요청 화면에서 문의 및 권리 행사 방법을 확인할 수 있습니다.

운영: 제자광성교회 뉴웨이브 청소년부
문의: 앱의 고객지원 화면에서 문의 방법을 확인해 주세요.
```

설명은 일반 텍스트 4,000자 이내로 입력한다. 현재 초안에 Apple 로그인, 오프라인 저장, 푸시 알림, 즉시 자동 탈퇴를 지원한다고 적지 않았다. 앱의 '알림' 메뉴를 OS 푸시 알림이라고 소개하지 않는다.

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
이 앱은 제자광성교회 뉴웨이브 청소년부의 승인된 성인 교사·사역 담당자가 사용하는 업무 앱입니다. 학생·보호자는 앱 계정을 만들지 않습니다. 주요 기능은 말씀·기도 실천 기록, 일정, 학생 출석, 반 공동 보고와 행사 참석 관리입니다.

제공한 계정은 실제 회원·학생 자료와 분리된 가상 심사 환경으로 연결됩니다. 로그인 화면의 아이디 칸에 제공한 이메일 전체를 붙여 넣으세요. 도메인이 자동으로 직접입력으로 바뀌며 '가상 심사 환경' 안내가 표시됩니다. 이메일·비밀번호 로그인으로 주요 기능을 검토할 수 있습니다.

로그인 후 이용수칙 안내가 나오면 내용을 확인하고 진행하세요. 홈에서 말씀·기도 체크와 개인 통계, 하단 일정에서 달력, 전체 메뉴에서 출석·행사 출석 체크·회의록을 확인할 수 있습니다. 관리 기능은 아래 추가 계정으로 로그아웃 후 다시 로그인하여 검토해 주세요.

새 교사·학생 프로필 사진은 저장 후 검토 대기 상태가 되며, 승인 전에는 기존 승인 사진만 다른 사용자에게 표시됩니다. 관리자 계정에서 전체 → 관리 → 사진 게시 검토로 이동해 사진을 열고 승인·거절 및 처리 안내를 남길 수 있습니다.

전체 → 콘텐츠·사용자 신고에서 신고를 접수하고 본인 처리 내역을 확인할 수 있습니다. 관리자 계정의 전체 → 관리 → 신고 관리에서는 담당·긴급 여부를 설정하고 현재 대상을 확인한 뒤 메모·사진·회의록·일정 보호 조치 또는 사용자 이용 정지를 처리합니다. 가입 승인·이용 정지 메뉴에서 상태 이력을 확인하며, 정지 해제는 최종 관리자만 사유를 남겨 처리합니다.

추가 관리자와 삭제 검수 전용 계정의 유효한 로그인 정보는 비공개 심사 정보에 함께 제공합니다.

계정 삭제는 내 정보 → 회원 탈퇴·계정 삭제 요청에서 신청합니다. 접수 후 로그아웃되며 접수증으로 처리 상태를 확인합니다. 신청 접수와 실제 삭제 완료는 구분되며 담당자가 처리합니다.

현재 준비 빌드는 Apple 로그인이 비활성입니다. 가상 심사 환경에서는 외부 Apple·카카오 인증을 제공하지 않으며 비공개로 제공한 이메일 계정으로 모든 업무·관리 기능을 확인합니다. 운영 환경의 선택 카카오 인증과 iPhone 복귀 동선은 최종 빌드에서 별도 확인합니다.
```

Review Notes는 최대 4,000바이트다. 위 본문은 비공개 추가 계정 정보가 빠진 공개 보관용이다. 콘솔에 넣을 때 추가 계정과 최종 인증 검토 결과를 합친 뒤 UTF-8 크기를 다시 확인한다. 소셜 인증 구성은 출시 빌드와 심사자에게 정확히 설명한다. 현재 Apple 로그인은 기본 비활성이며 가상 심사 서버는 Apple 키 설정을 허용하지 않는다. 이메일 가상 계정을 제공하는 것만으로 Apple 인증 전체를 검수할 수 있다고 적지 않는다. 실제 외부 인증의 검토 경로·필요 계정·시연 자료는 설정 완료 후 마련한다. [Apple 로그인 연결 현황](ios-apple-sign-in.md)

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

신고 관리의 일반 24시간·긴급 4시간은 운영자가 우선 확인할 내부 목표다. 실제 응답 시간이나 외부 푸시·메일 알림을 보장하는 문구로 옮기지 않는다. 사진 승인 전 미노출과 계정 정지는 서버에서도 적용되지만, 최종 iPhone에서 표시·권한·처리 결과가 일치하는지는 별도 검수한다.

## 3. App Privacy 입력 준비

현재 코드에 맞춘 선택값과 근거는 [개인정보·연령·암호화 제출 근거](ios-submission-evidence.md)에 확정해 두었다. **수집함: 예, 목적: App Functionality, 사용자 연결: 예, 추적: 아니오**로 준비한다. 실제 App Store Connect 저장·제출은 아직 하지 않았다.

선택할 데이터 유형은 Name, Email Address, Phone Number, Physical Address, Health, Sensitive Info, Contacts, Photos or Videos, Customer Support, Other User Content, User ID, Product Interaction, Performance Data, Other Diagnostic Data, Other Data Types다. 계정 없는 학생·보호자, 사진 승인 전 후보, 사진 검토·신고·정지 이력, 삭제 접수·조회 코드 해시도 범위에 포함한다.

- Health는 출결 사유의 현재 `몸살` 예시가 건강상태 입력을 직접 유도하므로 포함한다. 일반 자유 기록만을 이유로 포함한 것이 아니다.
- Contacts는 수동 교사·학생·보호자 목록과 관계를 저장하기 때문이다. 단말 주소록 권한은 요청하지 않는다.
- Customer Support는 앱 내 신고·삭제 요청 및 처리 내역을 포함한다. 해당 기능에 선택 공개 예외를 적용하지 않는다.
- 카카오 회원번호만 계정에 저장하지만 필드 제한 없는 인증 응답을 일시 처리하므로 프로필·이메일을 네트워크로 전혀 받지 않는다고 설명하지 않는다. 공개 방침 문구를 실제 처리에 맞게 정정했다.
- Railway 접속 IP·경로·상태·요청/응답 시간은 서비스 기능·보안·진단 목적의 로그다. 위치나 기기 추적 ID로 자동 분류하지 않는다.
- Apple 로그인은 OFF다. 활성화할 때 적용할 [개인정보 안내 추가안](ios-apple-privacy-addendum.md)을 별도로 준비했다.

로컬 `PrivacyInfo.xcprivacy`는 App Store Connect의 개인정보 라벨을 대신하지 않는다. 민감정보·학생 자료의 별도 동의·대리인 확인·국외 이전 절차는 실제 운영에서 이행해야 하며, 방침 공개나 성인 대상이라는 사실만으로 완료된 것으로 보지 않는다. [Apple 개인정보 신고 기준](https://developer.apple.com/app-store/app-privacy-details/)

현재 방침 원본은 `frontend/src/content/privacyPolicy.js`, 시행일은 `2026-10-15`, `publicationReady=true`다. 정적 공개 HTML은 `frontend/tools/build-privacy-policy.mjs`가 만든다. 기존 2026-10-15 브라우저 확인에서는 로그인 없이 지원·방침·삭제 안내를 열었고 PWA 업데이트 후 최신 내용을 확인했다. 이번 카카오 정정까지 포함한 최종 공개 화면 재확인과 iPhone 삭제 전 과정 검수는 최종 배포 증거에 기록한다. 실제 권리 행사 신청이나 외부 메일 발송은 이 문서 조사에서 수행하지 않았다.

## 4. 연령·암호화 질문 준비

[제출 근거의 연령 표](ios-submission-evidence.md#2-연령-설문-답변)에 실제 기능별 응답을 마련했다. UGC와 공동 게시를 포함하는 Messaging and Chat은 예, 소셜 미디어·제한 없는 웹 접근·광고·부모 통제·연령 검증은 아니오로 준비한다. 별도 실시간 채팅은 없으며 관리자의 가입 승인은 연령 검증이 아니다. Health 수집 신고와 달리 진단·치료·웰니스 조언 기능은 제공하지 않는다.

욕설·공포·약물·성적 내용·폭력 빈도는 고정 화면·합성 자료 기준 None 초안이다. 실제 운영자가 게시할 회의 본문·영상·성경 인용의 빈도 확인은 제공자에게 남는다. 현재 성인 대상 설명을 유지하며 실제 이용조건의 최소 연령이 자동 산정 등급보다 높다면 상향한다. 최종 한국 지역 표시값은 콘솔에서 확인한다. [Apple 연령 정의](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/), [연령 설정](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)

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

서명된 빌드의 수동 생성·선택 업로드 경로와 비밀값 격리, iPhone 검수 13개 흐름 및 원본 캡처 절차를 [TestFlight 운영 절차](ios-testflight-runbook.md)에 준비했다. 가상 프로파일/번들 검사는 실제 배포 인증서 검증이나 iPhone 통과를 뜻하지 않는다. 기존 CI의 비로그인 시작 화면 증거도 위 다섯 장의 완성품으로 사용하지 않는다. App Store의 접근성 지원 표시는 VoiceOver·큰 글자 등 최종 기기 검수 결과가 확인된 항목만 선택한다. [접근성 표시 개요](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/)

## 6. 미완료 관문과 제출 자료

| 관문 | 현재 상태 | 완료 증거 |
| --- | --- | --- |
| 개발자 가입·제출 명의 | 개인 가입 대기, 결제·활성화 미확인 | 활성화된 멤버십과 선택 명의 확인 |
| 민감정보 앱의 제출 주체 | 개인 가입 가능 여부와 이 앱 심사 적합성은 별개 | 5.1.1(ix)에 따른 서비스 제공 주체·계정 유형 검토. 개인 가입 승인만으로 앱 적합성이 확인되지 않음 |
| Bundle ID·서명·배포 | 코드 값만 존재, 정식 업로드 미완료 | Apple App ID·배포 서명·프로비저닝·검증한 Archive |
| Apple/카카오 로그인·Apple 서버 알림 | Apple 기본 비활성. 서버 알림 코드·V011 준비, 운영 적용·실제 iPhone 인증 미완료 | V011 운영 적용, Apple 알림 수신 주소 등록·실제 알림 처리·실기기 인증/복귀/철회/계정 삭제 검증, 필요한 정책 갱신 |
| 최종 iPhone 기능 검수 | Windows 구조·기존 자동 검증과 별도 | 위 심사 동선, 사진 권한, 키보드·안전 영역, 재시작·외부 인증·삭제 결과 |
| 심사 계정·가상 자료 | 기존 온라인 심사 환경 있음, iOS 최종 접근 미확인 | 유효한 교사·관리·삭제 전용 계정, 현재 접수 중 행사, 실제 자료 격리 |
| 정책·App Privacy·등급 | 데이터 유형·목적·연결성·추적 및 기능별 연령 응답 준비 완료 | 최종 공개 URL·제공 콘텐츠 빈도 확인, 계정 활성화 후 콘솔 저장·지역 등급 확인 |
| 화면·아이콘·메타데이터 | 공개 JSON·다섯 장 네이티브 촬영 자동화·규격/길이 검사 도구 준비. 실제 실행 산출물과 작업로그로 완료 확인 | 최종 서명 빌드와 화면 대조, 실제 권리자 표기·비공개 심사 정보 입력 |
| 수출 규정·권리·배포 방식 | OS 제공 암호화·면제 설정 준비, KR 무료 공개 배포 확정 | 정확한 권리자 이름 확인, 최종 Archive·콘솔 입력. 콘텐츠 제공 허락과 권리자 표기는 구분 |
| TestFlight·정식 심사 | 업로드·제출 미완료 | 처리된 빌드·기기 검증·심사 제출 기록 |

학생별 종교 활동을 기록하는 앱에는 [심사 지침 5.1.1(ix)](https://developer.apple.com/kr/app-store/review/guidelines/#data-collection-and-storage)의 민감정보 앱 제출 주체 규정이 관련될 수 있다. 개인 명의로 가입할 수 있다는 사실과 현재 앱을 개인 명의로 심사받을 수 있는지는 따로 확인한다. 이 문서는 법인 정보·개인 판매자 이름·전화번호·사업자 정보를 추정해 채우지 않는다.

기계 입력용 공개 자료는 [한국어 메타데이터 JSON](ios-store/metadata.ko-KR.json), 신고 근거는 [제출 근거](ios-submission-evidence.md)에 있다. JSON에는 비공개 심사 연락처·비밀번호를 넣지 않는다. 권리자 확인 전 저작권 값은 공란이며 검사에서 미완료로 표시한다.

## 7. 조사 근거와 검증 범위

- 기능·이동: `frontend/src/pages/Login.jsx`, `MenuPage.jsx`, `ProfilePage.jsx`, `AccountHelpPage.jsx`, `frontend/src/components/layout/BottomNav.jsx`, `frontend/src/router/index.jsx`.
- 심사 분기: `frontend/src/auth/reviewEnvironment.js`, `frontend/src/api/auth.js`, `frontend/src/components/common/EmailInput.jsx`, [기존 심사 준비](android-store/review-instructions.md).
- 데이터 구조: `backend/src/main/java/com/newaveflow/entity/`의 `User.java`, `Student.java`, `StudentMemo.java`와 관련 출석·TTS·신고 엔티티. 실제 DB·명단·백업·비밀값을 읽지 않음.
- 안전 기능·처리 이력: `PhotoModerationService.java`, `ModeratedPhoto.java`, `ContentReport.java`, `UserStatusEvent.java`, `AccountDeletionRequest.java`, `frontend/src/pages/ContentPhotosAdminPage.jsx`, `ContentReportsAdminPage.jsx`, `AdminPendingUsersPage.jsx`, `frontend/src/components/common/PhotoReviewStatus.jsx`. 건강 입력 안내는 `frontend/src/pages/AttendancePage.jsx`·`ClassManagePage.jsx`를 대조했다.
- 개인정보: `frontend/src/content/privacyPolicy.js`, [기존 데이터 조사](android-store/data-safety-draft.md). 과거 Android 자료의 '방침 없음/미공개' 상태는 현재 원본과 달라 그대로 사용하지 않음.
- iOS 설정: `frontend/ios/App/App.xcodeproj/project.pbxproj`, [iOS 개발](ios-development.md), [Apple 로그인](ios-apple-sign-in.md).
- 실행 범위: 코드·문서와 Apple 공식 요구사항 조사, 제출 초안 작성·문구 길이 확인. 실제 가입·결제·계정 변경·심사 제출·업로드·운영 데이터 변경 없음.
