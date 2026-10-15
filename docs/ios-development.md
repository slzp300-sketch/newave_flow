# iOS 개발과 검증

기존 React 웹 파일을 포함하는 Capacitor iOS 앱이다. iOS 15 이상과 Xcode 26 이상을 기준으로 한다. Swift Package Manager를 사용하고 Capacitor iOS·core 버전은 8.5.3으로 맞춘다. 앱 식별자는 가입 후 등록 가능 여부를 확인할 `app.newaveflow.mobile`이며 배포용 Apple 서명은 아직 설정하지 않았다.

## 코드와 빌드

`frontend/ios/App/App.xcodeproj`를 Xcode에서 연다. `App` 공유 스킴에는 앱과 `AppTests`가 있으며 iPhone을 지원한다.

```sh
cd frontend
npm ci
npm test
npm run ios:sync
npm run ios:verify
```

Windows에서도 웹 파일 생성과 iOS 동기화·구조 검사를 할 수 있다. Xcode 컴파일과 iPhone·iPad 시뮬레이터 검사는 macOS의 `.github/workflows/ios-check.yml`에서 진행한다. 기본 GitHub macOS 실행 환경을 사용하며 Apple 개인 키나 운영 DB 인증이 필요하지 않다. 시뮬레이터에서도 Keychain 권한을 확인하므로 임시 ad-hoc 서명을 사용한다. `CODE_SIGNING_ALLOWED=NO`는 컴파일에 성공해도 실행 시 Keychain 오류 -34018을 일으킨다. 이 임시 서명은 개발자 계정·배포 인증서가 필요한 TestFlight 서명과 별개다.

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES build

xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'platform=iOS Simulator,name=<설치된 iPhone 이름>' \
  -parallel-testing-enabled NO \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES test
```

`ios:verify`는 네이티브 파일 연결·테스트 대상·아이콘·출처·개인정보 manifest 등 잘못된 빌드 구성을 검사한다. Swift 컴파일·시뮬레이터 검사나 실제 iPhone 검수를 대신하지 않는다. 시뮬레이터용 앱은 실제 iPhone에 설치할 수 없다. 실제 설치는 개발자 가입·서명 후 TestFlight로 진행한다.

`ios-check.yml`은 이제 최종 `App.app`에도 `tools/ios/verify-bundle.py`를 실행해 자체·Capacitor·Cordova 개인정보 manifest, 동봉 웹/방침, iPhone 설정과 원격 개발 서버·브리지 로그·개인 키 혼입을 검사한다. 새로운 네이티브 SDK/manifest가 추가되면 허용 목록 검토 없이 통과하지 않는다. 서명·TestFlight는 별도 `ios-testflight.yml`의 수동 실행으로 준비했다. 정확한 main SHA·보호 환경·자격증명이 있어야 서명하며 업로드는 기본 꺼짐이다. 실제 서명·Apple 업로드 성공은 아직 검증하지 않았다. 설정·비밀값 이름·검수 기록표·스크린샷 준비·계정 활성화 후 순서는 [TestFlight 운영 절차](ios-testflight-runbook.md)에 정리했다.

`TARGETED_DEVICE_FAMILY=1`과 최종 번들의 `UIDeviceFamily=[1]`은 iPhone 화면 구성을 뜻한다. [Apple의 호환 기기 검수 안내](https://developer.apple.com/help/app-review/before-submitting-for-review/test-compatible-devices)에 따르면 iPhone 앱도 iPad의 호환 모드에서 실행될 수 있으므로, iPad 전용 앱으로 바꾸지 않고 이 경로를 검사한다. `tools/ios/select-simulator.py`는 `--family iphone`과 `--family ipad`를 각각 선택하며, 설치된 iOS 런타임의 주·부·패치 버전을 숫자로 비교한다. 해당 기기가 없으면 다른 종류로 대체하지 않고 실패한다. 동률인 기기 이름·식별자로 선택을 고정하며, 이 이름 순서가 최신 기종이나 모든 화면 크기의 검증을 뜻하지는 않는다.

CI는 한 번 빌드한 동일한 Release `App.app`을 두 시뮬레이터에 순서대로 설치·실행하고, 비로그인 첫 화면에서 브랜드와 비밀번호 안내가 보이는지 OCR로 확인한다. `ios-native-verification` 산출물에는 `iphone-launch.png`, `ipad-compatibility-launch.png` 및 각각의 기기 이름·런타임·식별자를 담은 `iphone-simulator.json`, `ipad-simulator.json`이 포함된다. iPhone의 Keychain·WKWebView 검사는 별도로 유지한다. 새 iPad 검증의 실제 통과 여부는 변경 후 macOS 실행 결과와 이미지로 확인해야 한다. 선택기 회귀 검사는 합성 기기 목록만 사용하여 Windows에서도 `python -B -m unittest discover -s tools/ios -p 'test_simulator_selection.py'`로 실행할 수 있다.

## 보안 저장과 카카오 인증

`NewaveSecureStoragePlugin`은 `newave-auth`, `newave-kakao-pending`, `newave-deletion-receipt`만 허용한다. Swift 저장소는 Keychain에서 로그인·OAuth 증명·삭제 접수증을 별개 항목으로 저장하고 다른 앱·장치 백업과 공유하지 않는다. 로그아웃해도 삭제 처리 결과를 확인할 수 있도록 접수증은 유지한다. 읽기·쓰기 실패 시 평문으로 대체하지 않는다. Keychain이 앱 제거 후 남을 수 있어 새 설치 시 이전 항목을 정리한다. 설치 여부만 자체 UserDefaults에 저장하며 그 API 사유를 `PrivacyInfo.xcprivacy`에 선언했다. 개인정보 수집 항목 전체는 App Store 등록 단계에서 별도로 작성한다.

저장값이 없을 때도 네이티브 조회는 `{ value: null }` 객체를 반환한다. 인자 없는 `call.resolve()`는 JavaScript에 `undefined`를 전달해 새 설치의 로그인 초기화를 실패시키므로 사용하지 않는다. WKWebView 검사는 실제 네이티브 브리지를 통해 빈 값 조회·가상 값 저장·조회·삭제와 삭제 후 재조회를 확인한다.

카카오 시작 요청은 web·android·ios를 구분하고 Android와 iOS 모두 기존의 일회성 인증 결과와 기기 증명으로 앱에 복귀한다. 앱 이동 주소에 로그인 JWT를 넣지 않는다. `newaveflow://auth/kakao`의 정확한 경로·필드와 기기 증명·만료를 검사한다. 앱 출처는 `capacitor://localhost`만 추가했다. 브라우저 임의 출처나 `null` 출처를 허용하지 않는다.

기존 Android 저장소는 카카오 임시 증명의 키를 거절하고 로그인 키 하나만 보관했다. 두 키를 각각 암호화해 저장·조회·삭제하도록 수정했고 기존 로그인 키·암호화 형식은 유지한다. 기존 Play 버전 5 파일은 변경하지 않는다. Android 수정은 다음 앱 빌드에 포함된다.

## 검수 경계와 출시 전 작업

자동 서버 검사는 합성 자료를 사용한다. Keychain 검사는 임시 테스트 항목을 만들고 제거한다. 실제 학생·교사 자료나 운영 사용자 비밀번호로 쓰기 검수하지 않는다. 클라우드 시작 화면은 비로그인 화면만 확인한다.

시작 화면 OCR과 기존 WKWebView 검사는 소프트웨어 키보드를 열거나 화면을 회전하지 않는다. 따라서 iPad 호환 모드의 설치·초기 표시가 통과해도 입력란 확대, 키보드에 가려진 버튼, 가로 화면의 스크롤·여백, 로그인 후 고정 메뉴·사진 모달의 조작까지 검증한 것으로 기록하지 않는다. 실제 기기 검수에서는 iPhone과 iPad 호환 모드의 세로·가로 화면에서 이메일·직접 입력 도메인·비밀번호 입력, 키보드 열기·닫기, 로그인·지원 링크 접근, 사진 선택·닫기와 하단 메뉴 접근을 확인한다. 이번 보완에는 UI 테스트 대상이나 앱 화면 변경을 포함하지 않는다. 서명 후 실제 기기 검수 또는 별도 네이티브 UI 자동화가 필요한 항목이다.

Apple 로그인·기존 계정 연결·승인 대기 가입과 외부 인증 철회 감시는 구현했으며 기본 비활성이다. 설정·남은 검수는 [Apple 로그인 연결](ios-apple-sign-in.md)을 따른다. 앱 내 탈퇴 접수·로그아웃 후 접수증 조회와 수동 삭제 절차 연결은 [계정 삭제 운영 절차](account-deletion-runbook.md)에 정리했다.

등록 대기 중에 Apple 서버 알림의 서명·중복·순서 검증과 인증 철회, 계정 삭제 시 알림 기록 제거를 추가했다. V011은 선택적 사전 준비이며 운영에는 적용하지 않는다. 로그인과 알림은 기본 비활성이고 활성화 전에는 PostgreSQL V011 적용·실제 Apple 수신 주소 등록과 수신 검증이 필요하다. [App Store 입력 초안](ios-app-store-submission.md)과 [콘텐츠 안전 점검](ios-content-safety-audit.md)도 준비했으며, 회의록 관리 현황과 비공개 확인 요청의 권한 누락을 수정했다.

실제 iPhone에서는 사진 선택·카메라 권한·키보드·여백·카카오 복귀·로그인 재시작·이용수칙·신고·Apple 인증·삭제 접수증을 TestFlight로 확인한다. Apple 계정 설정·실제 알림 수신 검증, 콘텐츠 안전 기능의 실제 기기 검수, App Store 개인정보·등급의 최종 답변·화면 자료와 정식 심사가 남아 있다. 코드와 시뮬레이터 검증을 App Store 제출 완료로 표시하지 않는다.

사용자 보고 기준 개인 개발자 가입은 등록 대기 중이며 결제·멤버십 활성화는 별도 확인하지 않았다. 학생·종교 관련 수집 항목이 있는 이 앱의 개인 명의 제출 적합성은 가입 승인과 별도로 확인한다. 인증서 발급·TestFlight 업로드는 기본 컴파일 검증과 별도 절차다. 상세 범위와 일정은 [iOS 개발과 출시 계획](ios-release-plan-2026-10-15.md)을 따른다.
