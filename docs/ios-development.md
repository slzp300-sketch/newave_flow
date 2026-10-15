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

Windows에서도 웹 파일 생성과 iOS 동기화·구조 검사를 할 수 있다. Xcode 컴파일과 iPhone 시뮬레이터 검사는 macOS의 `.github/workflows/ios-check.yml`에서 진행한다. 기본 GitHub macOS 실행 환경을 사용하며 Apple 개인 키나 운영 DB 인증이 필요하지 않다. 시뮬레이터에서도 Keychain 권한을 확인하므로 임시 ad-hoc 서명을 사용한다. `CODE_SIGNING_ALLOWED=NO`는 컴파일에 성공해도 실행 시 Keychain 오류 -34018을 일으킨다. 이 임시 서명은 개발자 계정·배포 인증서가 필요한 TestFlight 서명과 별개다.

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

## 보안 저장과 카카오 인증

`NewaveSecureStoragePlugin`은 `newave-auth`와 `newave-kakao-pending`만 허용한다. Swift 저장소는 Keychain에서 로그인과 OAuth 증명을 별개 항목으로 저장하고 다른 앱·장치 백업과 공유하지 않는다. 읽기·쓰기 실패 시 평문으로 대체하지 않는다. Keychain이 앱 제거 후 남을 수 있어 새 설치 시 이전 항목을 정리한다. 설치 여부만 자체 UserDefaults에 저장하며 그 API 사유를 `PrivacyInfo.xcprivacy`에 선언했다. 개인정보 수집 항목 전체는 App Store 등록 단계에서 별도로 작성한다.

카카오 시작 요청은 web·android·ios를 구분하고 Android와 iOS 모두 기존의 일회성 인증 결과와 기기 증명으로 앱에 복귀한다. 앱 이동 주소에 로그인 JWT를 넣지 않는다. `newaveflow://auth/kakao`의 정확한 경로·필드와 기기 증명·만료를 검사한다. 앱 출처는 `capacitor://localhost`만 추가했다. 브라우저 임의 출처나 `null` 출처를 허용하지 않는다.

기존 Android 저장소는 카카오 임시 증명의 키를 거절하고 로그인 키 하나만 보관했다. 두 키를 각각 암호화해 저장·조회·삭제하도록 수정했고 기존 로그인 키·암호화 형식은 유지한다. 기존 Play 버전 5 파일은 변경하지 않는다. Android 수정은 다음 앱 빌드에 포함된다.

## 검수 경계와 출시 전 작업

자동 서버 검사는 합성 자료를 사용한다. Keychain 검사는 임시 테스트 항목을 만들고 제거한다. 실제 학생·교사 자료나 운영 사용자 비밀번호로 쓰기 검수하지 않는다. 클라우드 시작 화면은 비로그인 화면만 확인한다.

실제 iPhone에서는 사진 선택·카메라 권한·키보드·여백·카카오 복귀·로그인 재시작·이용수칙·신고를 TestFlight로 확인한다. Apple 로그인, 앱 내 탈퇴 접수, 콘텐츠 기준 대조·보완, App Store 개인정보·등급·화면 자료와 정식 심사가 남아 있다. 이 기본 프로젝트를 App Store 제출 완료로 표시하지 않는다.

개발자 명의는 학생·종교 관련 수집 항목과 Apple 기준을 대조해 가입 전에 결정한다. Apple 가입·결제·인증서 발급·TestFlight 업로드는 기본 컴파일 검증과 별도 절차다. 상세 범위와 일정은 [iOS 개발과 출시 계획](ios-release-plan-2026-10-15.md)을 따른다.
