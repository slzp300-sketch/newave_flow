# iOS 서명·TestFlight 준비와 iPhone 검수

기준일: 2026-10-15. 현재 개인 개발자 가입은 사용자 보고 기준 등록 대기다. **아래 자동화와 가상 검증은 준비됐지만 배포 인증서·서명된 IPA·Apple 업로드·TestFlight 설치가 완료된 것은 아니다.** 이 문서에는 비밀번호, Apple ID, 개인 키, 인증서 소유자 정보, 실제 학생·교사 자료를 넣지 않는다.

## 등록 대기 중 준비한 범위

- `ios-check.yml`: Xcode 26 이상 Release 시뮬레이터 빌드, Keychain·브리지·화면 검사와 최종 App.app의 개인정보 manifest·정적 웹 파일·HTTPS 설정 검사.
- `tools/ios/verify-bundle.py`: 앱 Bundle ID·버전·지원 기기·콜백·사진 권한 안내, 자체 UserDefaults 사유, Capacitor/Cordova의 manifest 실제 포함 여부를 검사한다. 광고 추적 선언·원격 개발 서버·네이티브 응답 로그·웹 번들의 개인 키/소스맵이 들어오면 실패한다. App Privacy 신고나 실제 네트워크 분석을 대신하지 않는다.
- `ios-testflight.yml`: main에서만 직접 실행하는 서명·IPA 내보내기와 선택 업로드 경로. 자동 push/PR 실행은 없고, 업로드 기본값은 `false`다. 현재 저장소 활성화 변수·보호 환경·Apple 비밀값은 이 작업에서 설정하지 않았다.
- `test_release_tools.py`: 가상 프로파일·앱 번들로 잘못된 팀, wildcard/개발/Ad Hoc/기업 배포, 만료, Apple 권한 누락, 입력 변조, 추적 선언, 최종 SDK manifest 누락 등을 거절하는지 검사한다.

```sh
python3 -B -m unittest discover -s tools/ios -p 'test_*.py'
python3 tools/ios/verify-bundle.py <시뮬레이터의-App.app>
```

Capacitor와 Cordova는 Apple의 개인정보 manifest 필수 SDK 목록에 있다. 현재 `capacitor-swift-pm` 8.5.3은 체크섬으로 고정한 두 바이너리 SDK를 사용한다. Xcode의 공급자 서명 확인과 최종 번들 검사를 함께 유지하며 새 SDK 추가 시 이 목록을 다시 대조한다. App/Browser 플러그인은 잠금 파일 버전의 Swift 소스이며 현재 앱이 별도로 사용하는 UserDefaults는 `CA92.1` 사유로 선언했다. [Apple SDK 기준](https://developer.apple.com/support/third-party-SDK-requirements/), [Capacitor manifest 안내](https://capacitorjs.com/docs/ios/privacy-manifest), [고정된 Swift Package 정의](https://github.com/ionic-team/capacitor-swift-pm/blob/8.5.3/Package.swift)

## 활성화 후 한 번 준비할 설정

1. 멤버십 활성화, 제출 주체 적합성, 필요한 계약 상태를 확인한다. Bundle ID `app.newaveflow.mobile`을 등록하고 App Store Connect에 iOS 앱 레코드를 만든다. 이 앱을 다른 ID로 등록해야 한다면 코드·카카오 복귀·Apple 대상 검증을 함께 변경하고 다시 검사한다.
2. Apple Distribution 인증서와 그 개인 키가 포함된 암호화 `.p12`, 이 앱 전용 App Store 배포 프로파일을 만든다. Mac이 없으면 승인된 일회용 macOS 환경에서 키 생성·서명 요청을 진행할 수 있지만, 키 생성과 인증서 발급은 가입 승인 후 별도 실행한다. 임의의 타인 인증서를 사용하지 않는다.
3. `ios-testflight` GitHub Environment를 만들고 배포 허용 브랜치는 `main` 하나, 필수 검토자는 계정 소유자로 설정한다. 단독 운영이면 본인이 요청한 실행을 승인할 수 있도록 self-review 차단 여부를 구성한다. 관리자 우회도 비활성으로 설정한다. 현재 공개 저장소의 무료 플랜에서도 필수 검토자 보호를 지원한다. [환경 보호와 비밀 접근 시점](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
4. 아래 비밀값을 **그 Environment**에 입력한다. 일반 저장소 파일·노션·채팅·공개 로그에 저장하지 않는다. 이 workflow는 배포 프로파일이나 인증서를 자동 발급·갱신하지 않는다. [GitHub의 Apple 서명 자료 보관 방식](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
5. 환경 보호와 비밀값 검토를 마친 뒤 저장소 변수 `IOS_RELEASE_CONFIGURED=true`를 설정한다. 이 변수는 환경 보호가 실제로 설정됐다는 운영 확인 표시이며, workflow가 GitHub 보호 설정을 조회·보증하는 기능은 아니다. 미설정 상태에서는 Ubuntu 사전 검사에서 멈춰 macOS 서명 작업을 시작하지 않는다.

| Environment secret | 필요한 값 | 사용 시점 |
| --- | --- | --- |
| `APPLE_TEAM_ID` | 해당 개발자 팀의 10자리 ID | 서명 |
| `IOS_CERTIFICATE_BASE64` | 개인 키를 포함한 암호화 Apple Distribution `.p12`의 한 줄 Base64 | 서명 |
| `P12_PASSWORD` | 위 `.p12` 암호 | 서명 |
| `IOS_PROFILE_BASE64` | `app.newaveflow.mobile` 전용 App Store 배포 프로파일의 한 줄 Base64 | 서명 |
| `ASC_API_KEY_ID` | App Store Connect 팀 API 키 ID | `upload=true`인 단계만 |
| `ASC_API_ISSUER_ID` | 위 팀 API 키의 Issuer ID | `upload=true`인 단계만 |
| `ASC_API_KEY_BASE64` | 위 API 키 `.p8`의 한 줄 Base64 | `upload=true`인 단계만 |

현재 업로드 어댑터는 Issuer ID가 있는 **팀 API 키** 형식으로 준비했다. 개인 개발자 멤버십과 API 키의 '팀/개인' 유형은 별개다. 활성화된 계정에서 사용 가능한 키 유형과 최소 권한을 확인하고, 개인 API 키만 사용할 수 있는 경우 어댑터를 먼저 맞춘 뒤 실행한다. Apple 로그인 서버용 `.p8`와 App Store Connect 업로드 `.p8`는 별개 용도이므로 서로 대체하지 않는다.

## 서명 빌드와 선택 업로드 실행

1. 같은 main 커밋의 웹·백엔드 회귀 검사와 `iOS native checks`가 성공했는지 확인한다. 기능이 변경됐으면 해당 SHA로 다시 검수한다.
2. Actions의 `iOS signed build and optional TestFlight upload`를 main에서 실행한다. `commit_sha`는 현재 main의 전체 40자리 SHA, `version`은 예를 들어 `1.0.0`, `build_number`는 App Store Connect에서 아직 사용하지 않은 증가 번호를 입력한다. workflow가 원격의 번호 중복을 예약·조회하지는 않는다. 처음에는 `upload=false`로 서명·내보내기를 확인한다.
3. `apple_login=false`는 기본 UI/이메일 흐름의 내부 검수용이다. 최종 App Store 제출 준비 완료를 뜻하지 않는다. `true`는 서버 V011·Apple 설정·실제 수신 주소·능력 활성화·기기 검증 준비가 끝난 뒤 선택한다. 이 경우 프로파일과 최종 앱의 Apple 로그인 entitlement가 모두 일치해야 한다.
4. Environment 승인 화면에서 SHA·버전·번호·Apple 로그인·업로드 선택을 확인하고 승인한다. `upload=true`에는 추가로 `UPLOAD TO TESTFLIGHT` 문구가 필요하다. 이는 Apple 계정에 해당 IPA를 보내는 동작이다. 테스터 초대·외부 베타 심사·정식 심사 제출·공개 출시는 실행하지 않는다.
5. 프로파일의 앱·팀·배포 유형·만료와 인증서 일치를 검사하고 임시 Keychain에서 서명한다. Archive와 내보낸 IPA 모두 Bundle ID·버전·개인정보 파일·서명·권한을 다시 확인한다. 배포용 인증서·프로파일은 24시간 이상 유효해야 한다.
6. 선택 업로드는 먼저 Apple의 바이너리 검증을 호출하고, 같은 SHA256의 IPA를 전송한다. 업로드 명령 성공 후에도 App Store Connect의 처리 결과·경고·TestFlight 빌드 표시를 직접 확인한다. 중단/시간 초과일 때는 중복 업로드 전에 해당 버전·빌드가 이미 들어갔는지 먼저 확인한다. [Apple 빌드 업로드와 처리](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)

공개 CI artifact에는 커밋·버전·빌드·IPA SHA256·업로드 명령 실행 여부만 들어간 영수증을 5일 보관한다. 인증서 소유자 이름이 포함될 수 있는 서명 로그, 프로파일, `.p8`, `.p12`, IPA, Archive 및 dSYM은 업로드하지 않는다. 실패 시에도 `always` 정리가 이 실행에서 만든 자료만 제거하고 GitHub 호스팅 runner는 종료 후 폐기된다. 원시 서명 로그를 공개하지 않기 때문에 최초 실제 서명 실패는 보호된 macOS 환경에서 원인을 다시 확인해야 할 수 있다.

### 암호화와 제출 답변

앱은 HTTPS/WKWebView, Keychain 및 Apple 인증을 사용한다. 현재 Info.plist에 `ITSAppUsesNonExemptEncryption` 답을 임의로 추가하지 않았다. 최종 바이너리의 암호화 방식과 배포 지역을 Apple 질문에 대조한 뒤, 면제 여부·필요 문서를 확인해 답변한다. 자동화는 암호화 신고를 대신 제출하거나 개인 명의 제출 적합성을 승인하지 않는다. [암호화 문서 판단](https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-app-encryption-documentation/)

## 실제 iPhone 검수 기록표

TestFlight에서 설치한 버전·빌드·기기/iOS·검수 날짜를 기록하고 아래 결과를 `미실행 / 통과 / 실패(재현 순서)`로 남긴다. 개인 기기의 알림·사진·비밀번호를 촬영하지 않으며 쓰기 검수는 가상 계정과 가상 자료로 제한한다. 삭제 전용 계정과 관리자/교사 계정을 따로 준비한다. 시뮬레이터 결과를 실제 기기 통과로 옮겨 적지 않는다.

| 검수 | 재현 순서 | 통과 기준 |
| --- | --- | --- |
| 첫 설치·화면 | 설치 → 실행 → 작은/큰 글자, 세로/가로, 키보드 열기 | 첫 화면·노치·하단·버튼이 가려지지 않고 빈 화면/강제 종료 없음 |
| 이메일과 환경 | 가상 이메일 전체 입력 → 표시 확인 → 로그인 → 로그아웃 → 재로그인 | 가상 환경으로만 저장·조회하고 다른 계정 캐시 없음 |
| Keychain | 로그인 후 앱 종료·재실행, 로그아웃 후 재실행, 제거·재설치 | 로그인 유지 정책과 새 설치 정리가 적용되고 로그아웃 계정 복원 없음 |
| 외부 카카오 | 로그인/연결 → 취소 → 재시도 → 앱 복귀 → 만료된 복귀 재사용 | 정상 복귀, 취소 안내, 중복·만료 결과 거절 |
| Apple | 준비 완료된 빌드에서 신규/기존 연결, 이메일 숨기기, 취소, 재로그인, 기기에서 연결 철회 | 자동 이메일 병합 없음, 승인 규칙 유지, 철회 후 기존 세션 거절 |
| 업무 저장 | 말씀·기도 체크, 주간 통계, 일정, 반 출석·공동 보고, 행사 접수 | 가상 입력 저장·재조회, 한국 날짜, 마감·권한·중복 경계 정상 |
| 사진 | 선택/취소/카메라/권한 거절, 큰 이미지·통신 실패 | 민감한 사진 권한을 강제하지 않고 안내·복구 가능, 검토되지 않은 공유 사진 노출 없음 |
| 콘텐츠 안전 | 수칙 동의, 금지 내용·외부 링크 입력, 신고·차단·관리자 처리·복구 | 현재 구현한 안전 정책의 거절/보호/결과 안내가 실제 앱에서도 일치 |
| 권한 | 교사/관리자로 회의록·비공개 문서·관리 현황 확인 | 교사는 허용 자료만 조회·수정, 숨김/정지 조치가 재조회에 반영 |
| 삭제 | 전용 계정 본인 확인 → 접수 → 로그아웃 → 접수증 조회 → 가상 DB 처리 | 접수/처리 완료 구분, 남의 접수증 거절, 해당 계정·연결 정리와 공동 기록 보존 |
| 네트워크 | 비행기 모드·전환·앱 복귀, 실패 후 재시도 | 오류가 안내되고 저장 완료를 잘못 표시하지 않음 |
| 업데이트 | 이전 TestFlight 빌드에서 다음 빌드로 갱신 | 데이터·로그인 정책 유지, 변경된 화면·번들이 실제로 표시 |
| 접근성 | VoiceOver 주요 버튼·입력 읽기, 큰 글자, 색 구분, 동작 줄이기 | 핵심 흐름을 완료할 수 있는지 실제 확인. 통과 전 Accessibility 지원 항목을 신고하지 않음 |

TestFlight 내부 설치부터 시작하고, 이후 소수 외부 검수로 넓힌다. 첫 외부 빌드는 Apple 베타 검토가 필요할 수 있으며 Android의 12명·14일 조건을 적용하지 않는다. [내부 테스터](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/), [외부 테스터](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)

## 스크린샷 획득 준비

최종 iOS 기능이 검증된 뒤 실제 빌드의 가상 자료 화면을 촬영한다. 2026-10-15 열람한 Apple 공식 표의 필수 iPhone 표시는 Dynamic Island 중형이며 허용 세로 규격은 1179×2556 또는 1206×2622다. 보조 대형 화면은 1290×2796·1320×2868 등 공식 표를 따른다. 일단 중형 **1206×2622**를 작업 기준으로 삼고 제출 시 콘솔의 최신 요구를 다시 확인한다. 크기별 1~10장, PNG/JPEG, 투명도 없음. [공식 스크린샷 표](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

촬영 순서는 홈 → TTS 개인 통계 → 일정 → 가상 반 출석/공동 보고 → 행사 참석이다. 화면마다 해당 버전·빌드·기기·가상 자료 여부를 별도 기록한다. 시간순으로 가상 입력을 준비하고 로딩·오류·키보드·시스템 알림이 사라진 뒤 원본 크기로 저장한다. 로그인·비밀번호·접수증 비밀 코드나 실제 운영 명단이 보이면 사용하지 않는다. 기존 Android/웹 캡처를 iPhone 캡처로 대신하지 않는다.

macOS 시뮬레이터에 해당 빌드와 가상 자료 화면을 준비했을 때 사용할 캡처 명령은 다음과 같다. `simctl`은 현재 화면만 저장하므로 로그인·기능 검수·가상 자료 확인은 별도로 완료해야 한다. 현재 자동 CI의 `iphone-launch.png`는 비로그인 시작 화면 증거이며 이 다섯 장의 완성품이 아니다.

```sh
xcrun simctl io <검수용-simulator-UUID> screenshot --type=png <비공개-작업폴더>/01-home.png
```

## 계정 활성화 또는 운영자 확인이 필요한 잔여 항목

- Apple 멤버십 활성화·서비스 제공 주체/개인 명의 적합성·권리 보유자와 심사 연락처.
- App ID·Sign in with Apple capability·카카오 iOS 설정 대조·인증서/프로파일·업로드용 API 키와 보호 환경.
- V011 운영 적용 전 백업 복원 검증, Apple 실제 알림 수신 주소 등록·실제 계정 철회/삭제 검수 및 로그인 활성화.
- App Store Connect 앱 레코드, 실제 서명·IPA/Apple 처리 결과, iPhone TestFlight 검수와 최종 스크린샷.
- 실제 운영 동의·신고 담당·보존 절차, 최종 App Privacy·연령·암호화·접근성 답변, 유효한 가상 심사 계정.
- 베타/정식 심사 제출과 승인 후 공개 출시. 이 문서와 자동 검사의 성공은 Apple 승인이나 위 외부 작업 완료를 뜻하지 않는다.
