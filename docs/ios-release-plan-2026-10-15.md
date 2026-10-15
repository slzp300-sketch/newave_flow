# Newave Flow iOS 개발과 출시 계획

기존 React 화면과 Spring 서버를 재사용해 iPhone 앱을 만든다. 사용자는 Windows PC와 iPhone을 갖고 있고 Mac은 없다. 착수 당시 Apple Developer Program 미가입이었으며, 이후 개인 가입을 진행해 현재 사용자 보고 기준 등록 대기 중이다. 결제 완료·멤버십 활성화 여부는 별도로 확인하지 않았다. Windows에서 코드를 작성하고 GitHub Actions의 macOS 환경에서 빌드·서명·업로드한 뒤 iPhone의 TestFlight로 검수하는 구성을 기본안으로 삼는다.

2026년 10월 15일 기준 계획안이다. Android는 승인된 버전 5로 사용자가 테스터 모집과 비공개 테스트를 진행한다. 사용자는 iOS 개인 가입을 선택했으며 이 앱의 개인 명의 제출 적합성은 별도 확인 사항으로 남아 있다. 사용자의 개발 착수 요청으로 기본 iOS 프로젝트·보안 저장소·카카오 경로·네이티브 검사 설정을 구현했다. 최신 구현과 검증 방법은 [iOS 개발과 검증](ios-development.md)을 따른다.

후속 구현에서는 Apple 인증·계정 연결·승인 대기 가입·기기 인증 철회 감시와 앱 내 삭제 신청·독립 접수증 조회를 추가했다. 등록 대기 중에는 서버 간 알림의 서명 검증·중복 및 역순 방어·세션 철회와 가상 검사를 추가했다. Apple 실제 계정 설정·알림 수신 주소 등록·실제 iPhone 검수는 남아 있고 Apple 로그인은 기본 비활성이다. 아래 착수 전 표는 최초 조사 이력이며, 최신 코드 상태는 위 개발 문서와 [Apple 로그인 연결](ios-apple-sign-in.md)을 따른다.

등록 대기 중에 [App Store 제출 자료 초안](ios-app-store-submission.md)과 [콘텐츠 안전 점검](ios-content-safety-audit.md)을 작성하고 회의록 관리 현황·비공개 확인 요청의 권한을 보완했다. 게시 전 콘텐츠 검사와 정지 계정 관리 등 점검에서 발견한 나머지 항목은 출시 전 작업으로 남긴다. 알림 기록용 V011은 준비만 했으며 운영 DB에는 적용하지 않는다. 앱 식별자·권한·인증서·App Store Connect 등록·TestFlight 업로드는 멤버십 활성화 뒤 진행한다. 공개 고객지원·개인정보처리방침·계정 삭제 안내는 로그인 없이 접근할 수 있음을 확인했으며, 제출 직전에 다시 대조한다.

## 착수 전 코드와 재사용 범위

| 항목 | 현재 상태 | iOS 작업 |
|---|---|---|
| 화면과 서버 | React 18, Spring, Capacitor 8.5.3 | 출석·보고서·일정·영성체크·관리 화면 재사용 |
| 앱 프로젝트 | Android 프로젝트만 있음. iOS 의존성과 프로젝트 없음 | 같은 Capacitor 버전의 iOS 프로젝트와 빌드 경로 추가 |
| 로그인 보관 | `NewaveSecureStorage`의 Android 구현만 있음 | 같은 인터페이스를 제공하는 iOS Keychain 보관 구현 |
| 카카오 인증 | 프런트는 모든 네이티브 앱을 android로 전송, 서버는 web/android만 허용 | iOS 구분, 인증 후 앱 복귀, 취소·만료·재시작 경로 보완 |
| 서버 연결 | iOS 기본 출처인 `capacitor://localhost`가 허용 목록에 없음 | 실제 WKWebView 요청 확인 후 정확한 iOS 출처만 추가 |
| 회원 탈퇴 | 앱에서 삭제 요청 이메일을 작성하는 방식 | 앱 안에서 본인 확인·삭제 요청·진행 상태·결과 확인 |
| 콘텐츠 안전 | 이용수칙·신고·관리자 조치 구현됨 | Apple의 게시 필터·사용자 차단 기준과 대조해 보완 |
| 자동 검사 | 웹·서버·Android·가상 DB 검사 있음 | macOS iOS 컴파일·시뮬레이터·서명 검증 추가 |

근거 코드는 `frontend/package.json`, `frontend/capacitor.config.json`, `frontend/src/native/platform.js`, `frontend/src/native/secureStorage.js`, `frontend/src/auth/kakao.js`, `frontend/src/pages/AccountHelpPage.jsx`, `backend/src/main/java/com/newaveflow/dto/auth/KakaoStartRequest.java`, `backend/src/main/java/com/newaveflow/config/SecurityConfig.java`, `.github/workflows/check.yml`다.

## 개발자 명의와 환경 준비

Google Play는 개인 개발자 계정으로 진행했다. Apple의 개인 계정은 판매자에 본명이 표시되며, 조직 계정에는 법적 실체와 D U N S 등 검증이 필요하다. [Apple 가입 안내](https://developer.apple.com/help/account/membership/program-enrollment/)

교회·학생 관련 기록에는 민감정보가 포함될 수 있다. Apple은 민감정보를 요구하는 앱의 법인 제출 기준을 두고 있고, 개인정보 분류에 종교적 신념을 포함한다. 이 앱의 수집 항목과 운영 주체를 대조해 개인 명의 제출 적합성 또는 교회·법인 명의 요건을 **가입·결제 전에 확인한다**. 개인 명의로 가능한 것으로 미리 확정하지 않는다. [심사 기준 5.1.1](https://developer.apple.com/app-store/review/guidelines/#privacy), [민감정보 분류](https://developer.apple.com/app-store/app-privacy-details/)

10월 15일 사용자는 교회·법인 정보를 구할 수는 있지만 절차 부담 때문에 **개인 명의를 우선 희망**한다고 답했다. 이 선호를 기준으로 준비하되 개인 명의 제출 적합성이나 유료 가입 완료로 기록하지 않는다. 현재 앱의 학생 명단·출석·종교 활동 기록이 5.1.1(ix)에 해당할 가능성이 있어 가입·결제 전에 Apple에 확인할 내용은 다음과 같다. 실제 자료나 로그인 비밀값을 문의에 첨부하지 않는다.

> 교회 내부의 승인된 교사들이 학생 명단, 출석과 종교 활동 기록을 관리하는 앱을 개발하고 있습니다. 학생이 직접 가입하는 앱은 아니며 접근 권한을 제한합니다. 이 앱을 개인 개발자 명의로 제출할 수 있는지, 심사 기준 5.1.1(ix)에 따라 서비스를 제공하는 교회·법인 명의가 필요한지 확인하고 싶습니다. 필요한 운영 주체 증빙도 안내 부탁드립니다.

위 내용은 문의 초안이며 실제 발송이나 Apple의 적합성 확인은 아직 없다. 개인 계정 가입 자체는 iPhone의 Apple Developer 앱에서 할 수 있지만, 가입 가능 여부와 이 앱의 심사 적합성은 별도로 확인한다. [iPhone 가입 절차](https://developer.apple.com/help/account/membership/enrolling-in-the-app/)

Capacitor 8은 macOS와 Xcode 26 이상을 사용하고 iOS 15 이상을 지원한다. App Store Connect 제출도 현재 Xcode 26 이상의 iOS 26 SDK 빌드가 필요하다. 빌드에 쓰는 SDK와 사용자의 최소 iOS 버전은 별도 설정이다. [Capacitor 환경](https://capacitorjs.com/docs/getting-started/environment-setup), [iOS 지원 버전](https://capacitorjs.com/docs/updating/8-0), [Apple 제출 기준](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)

먼저 macOS 자동 빌드에서 개발자 인증서 없이 시뮬레이터용 임시 서명으로 빌드와 Keychain을 확인한다. 서명을 완전히 끄면 Keychain 검사가 실패하므로 시뮬레이터에서도 임시 서명을 유지한다. 성공하면 개발자 계정의 앱 식별자·배포용 서명 인증서·권한과 업로드 인증을 연결한다. 인증서와 개인 키는 보호된 CI 설정에 저장하고 로그·앱·일반 빌드 산출물에 포함하지 않는다. 초기 네이티브 오류를 CI 로그로 해결하기 어려울 때는 원격 Mac을 잠깐 사용할 수 있는 경로를 별도 검토한다. [GitHub iOS 서명 안내](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)

## 구현과 배포 순서

| 단계 | 작업 | 다음 단계로 넘어가는 기준 |
|---|---|---|
| 1. 계정과 빌드 준비 | 개발자 명의 결정, 가입 준비, macOS와 Xcode 환경 고정, 앱 식별자 확인 | 계정 경로와 비용을 이해하고 iOS 기본 컴파일 성공 |
| 2. iOS 기본 앱 | iOS 프로젝트, 아이콘·시작 화면, 화면 여백·키보드·사진 선택, 보안 로그인 보관, API 연결 | 앱 실행·로그인·재실행 유지와 기본 업무 화면 정상 |
| 3. 인증과 탈퇴 | 카카오 복귀, Apple 로그인, 계정 연결·승인 대기, 앱 내 삭제 접수 | 가상 환경에서 정상·실패·취소·권한 경계와 삭제 흐름 확인 |
| 4. Apple 제출 준비 | 콘텐츠 안전 대조·보완, 개인정보 표시·SDK manifest, 지원·처리방침, 설명·등급·심사 계정 | 실제 구현과 등록정보 일치, 핵심 기능과 안내 경로 접근 가능 |
| 5. TestFlight | 서명된 빌드 업로드, 본인 내부 검수, 이후 소수 외부 테스터 검수 | 실제 iPhone에서 주요 흐름 통과, 의견·수정 결과 기록 |
| 6. App Store | iPhone 화면 자료, 최종 버전 심사 제출, 보완 대응, 승인 후 게시 | 정식 스토어 설치와 운영 경로 확인 |

공통 서버 변경이 필요하면 기존 Android 버전 5와 웹의 호환성을 함께 확인한다. 새로운 인증·삭제 기능은 추가 방식으로 반영하고, DB 변경 시 기존 백업·복원 검증 절차를 따른다.

## 인증과 계정 삭제 설계

카카오 로그인을 유지하면서 Apple의 로그인 기준에 맞는 동등한 선택지를 제공하기 위해 **Apple 로그인 추가를 기본안에 포함한다**. 승인된 교사만 사용하는 앱이라는 이유로 교육·기업 계정 예외가 자동 적용된다고 가정하지 않는다. [로그인 기준 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)

Apple 인증은 서버가 서명·발급자·앱 대상·일회성 값을 검증한다. Apple 사용자의 고유 식별자로 연결하고 비공개 이메일을 지원한다. 이메일 일치만으로 기존 교사 계정을 합치지 않으며, 신규 사용자는 기존 승인 대기 규칙을 따른다. 취소, 재로그인, 첫 동의 후 이름·이메일 미전달, 기존 계정 연결, 연결 해제와 탈퇴를 검수한다.

앱 내 삭제는 본인 재인증 → 삭제 범위 확인 → 서버 접수 → 진행 상태와 완료 안내로 구성한다. 개인 기록 삭제와 공동 기록의 익명화·보존 규칙을 기존 삭제 절차와 연결한다. 작업 완료 전에는 삭제 완료로 안내하지 않는다. 이메일은 로그인 불가 상황의 보조 문의 경로로 유지한다. Apple은 일반 앱에서 이메일·전화 문의를 삭제의 필수 단계로 요구하지 않도록 안내한다. [앱 내 계정 삭제](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion)

삭제 검수는 가상 계정·가상 기록에서 진행한다. 다른 교사·학생 자료와 공동 기록 보존, 마지막 관리자 보호, 재시도, 세션 무효화, 기존 카카오 및 새 Apple 인증 연결 해제를 함께 확인한다. Apple 웹 인증에 Services ID를 쓰는 설계를 선택하면 한국 개발자 계정의 서버 알림 등록 요건도 적용 여부를 확인한다.

## iPhone 검수와 심사 준비

| 검수 흐름 | 확인할 결과 |
|---|---|
| 로그인·재시작 | 이메일·카카오·Apple 인증, 취소·만료, 로그아웃, 다시 실행했을 때 정상 보관 |
| 출석·보고·일정 | 가상 자료 조회·작성, 한국 날짜, 중복 제출, 서버 실패 안내 |
| 화면과 권한 | 노치·홈 표시줄 여백, 키보드, 작은 화면, 사진 선택과 취소·권한 거절 |
| 이용수칙·신고 | 명시적 동의, 신고 접수·본인 조회, 관리자 처리·결과 표시 |
| 계정 삭제 | 본인 재인증, 접수·처리 상태, 가상 계정 삭제, 공동 기록 보존 |
| 설치·업데이트 | TestFlight 설치, 버전 업데이트, 로그인 유지, 심사 환경과 운영 환경 구분 |

화면과 서버 쓰기 검수에는 기존 격리된 가상 심사 환경을 사용한다. iPhone의 TestFlight 설치와 실제 화면 조작은 사용자가 진행하고, 클라우드 시뮬레이터 검사와 별도로 기록한다. 기존 Android 실기기 통과를 iPhone 통과로 대체하지 않는다.

현재 신고·관리 조치를 Apple의 콘텐츠 기준과 대조하고, 게시 전 유해내용 검사·신고 대응·사용자 차단의 범위를 정한다. 출석·보고·관리 등 실제 업무 흐름과 사진 선택·로그인 보관·앱 복귀를 심사에서 확인할 수 있게 준비한다. [콘텐츠 안전과 앱 기능 기준](https://developer.apple.com/app-store/review/guidelines/)

개인정보 표시에는 실제 수집과 연계·이용 목적을 Apple 분류로 작성한다. Google의 항목을 그대로 복사하지 않는다. 앱과 SDK의 PrivacyInfo.xcprivacy 및 필요한 API 사유, 사진 사용 안내, 실제 iPhone 화면 자료와 유효한 가상 심사 로그인을 준비한다. 비밀번호·실제 학생 기록은 계획 문서와 일반 산출물에 넣지 않는다. [개인정보 표시](https://developer.apple.com/app-store/app-privacy-details/), [SDK 기준](https://developer.apple.com/support/third-party-SDK-requirements/)

TestFlight는 먼저 본인 내부 검수로 시작하고 외부 테스터는 3~5명을 권장한다. 이는 우리의 검수 계획이며 의무 인원·기간이 아니다. Google Play의 12명·14일 조건을 iOS에 적용하지 않는다. 외부 배포의 첫 빌드는 Apple의 별도 베타 검토를 거친다. TestFlight 통과 뒤 정식 App Store 심사도 진행한다. [TestFlight 외부 검수](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)

## 기간과 비용

다음은 계정·빌드 환경이 마련되고 2026년 10월 19일경 구현을 시작할 수 있다는 가정의 작업 일정이다. Apple의 처리 기한을 뜻하지 않는다.

| 잠정 일정 | 목표 |
|---|---|
| 10월 15~19일 | 개발자 명의·가입 경로와 빌드 환경 결정, 기본 iOS 컴파일 준비 |
| 10월 20~30일 | iOS 기본 앱과 로그인·삭제·콘텐츠 보완 구현 |
| 11월 2~6일 | TestFlight와 실제 iPhone 검수·수정 |
| 11월 9~13일 | 정식 심사 제출과 보완 대응 |
| 11월 16일 | Android와 함께 공개 출시를 목표로 검토 |

작업량은 대략 3~5주로 예상한다. 개발자 명의·가입 검증과 iOS 첫 빌드가 확인된 뒤 출시 목표일을 다시 확정한다. 조직 검증이나 심사 보완이 길어지면 일정도 이동한다.

Apple Developer Program 회비는 연 99 USD이며 지역별 통화·실제 결제액은 가입 화면에서 확인한다. GitHub macOS 빌드 비용은 계정의 포함 사용량·저장소 유형·실제 사용량에 따라 달라진다. 실행 전에 포함량과 비용 제한을 확인한다. [Apple 회비](https://developer.apple.com/help/account/membership/program-enrollment/), [GitHub 비용](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

첫 착수 작업은 개발자 명의 적합성 확인과 macOS 기본 컴파일 경로 준비다. 이후 iOS 보안 저장소·API 연결을 먼저 완성하고 인증·탈퇴·TestFlight로 이어간다.
