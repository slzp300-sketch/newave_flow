# iOS Apple 로그인 연결

Apple 로그인은 iPhone의 `AuthenticationServices`를 이용한다. 웹·Android에는 표시하지 않으며 서버 설정, iOS 앱 빌드 설정이 모두 준비된 경우에만 로그인·내 정보 화면에 나타난다. 현재 기본값은 비활성이다. Apple 유료 가입·App ID capability·인증서·실제 Apple 계정 인증이 완료되었다는 의미가 아니다.

## 인증 흐름

1. 앱이 무작위 기기 증명을 만들고 SHA-256 해시를 서버에 전달한다. 서버는 일회성 flowId, nonce, state를 발급한다.
2. `NewaveAppleSignInPlugin`이 Apple 시스템 인증창에 서버 nonce와 state를 그대로 전달한다. 요청이 겹치거나 값이 잘못되면 인증창을 열지 않는다.
3. 앱은 반환된 state를 비교하고 identityToken·authorizationCode와 기기 증명을 서버로 전달한다. Apple 서명·발급자·대상 앱·nonce·일회성 상태의 최종 검증과 토큰 교환은 서버가 담당한다.
4. 이미 연결된 승인 계정은 로그인한다. 기존 이메일 계정 연결에는 현재 비밀번호를 다시 확인한다. 이메일 일치만으로 연결하지 않는다.
5. 처음 이용하는 사용자는 기존 가입 신청 화면에서 이름·이메일·비밀번호·연락처를 입력하고 관리자 승인을 기다린다. Apple 이름·이메일은 첫 동의 때만 제공될 수 있으므로 이후 응답에서도 필수라고 가정하지 않는다.

Apple 인증 토큰·인가 코드는 저장하지 않는다. 등록용 일회성 증명은 메모리에 5분만 유지하고, 앱이 종료되면 다시 인증한다. Capacitor 기본 브리지 로그가 인증 결과를 출력할 수 있어 공통 `loggingBehavior`를 `none`으로 설정했다. 앱 로그인 세션은 기존 Keychain 저장소를 이용한다.

Apple로 로그인한 세션에만 서버가 검증해 반환한 Apple 사용자 식별자와 인증 방식·고유 세션 구분값을 Keychain에 함께 보관한다. 토큰 갱신 때 이 정보를 보존하고 이메일·카카오로 새로 로그인하거나 로그아웃하면 제거한다. 단순히 계정에 Apple이 연결되어 있다는 이유로 이메일 세션을 Apple 세션으로 취급하지 않는다.

앱 시작·화면 복귀·Apple 인증 철회 알림 때 `getCredentialState`로 현재 Apple 세션을 확인한다. 명시적인 `revoked`·`notFound` 응답이면 기존 로그아웃 API로 서버 세션을 종료하고 기기 세션과 조회 캐시도 비운다. 일시적인 조회 실패나 알 수 없는 상태만으로 로그아웃하지 않는다. 늦게 도착한 조회·로그아웃 응답은 이후 새로 로그인한 계정을 종료하지 않도록 세션 구분값으로 검사한다. 서버 로그아웃에 실패해도 이 기기는 로그아웃하며 다른 기기 종료를 확인하지 못했다는 안내를 표시한다. 삭제 접수 중에는 접수증 저장을 마칠 때까지 이 감시를 잠시 멈춘다.

Apple 버튼은 `ASAuthorizationAppleIDButton`의 시스템 그림을 기기에서 렌더한다. 별도 Apple 로고를 제작하거나 외부 스크립트를 불러오지 않는다. 활성화된 iPhone 앱에서는 버튼을 이메일 입력보다 먼저 표시한다. 취소는 일반 오류 안내를 띄우지 않고 화면으로 돌아온다.

## 정식 기기 빌드 활성화

먼저 Apple 개발자 계정과 앱 식별자에 Sign in with Apple capability를 등록하고 해당 권한이 포함된 provisioning profile을 준비한다. 서버의 Apple 키·설정과 토큰 철회 처리를 설정하고 검증한다. 키·Team ID·인증서는 저장소에 넣지 않는다.

서버 기본값은 `APPLE_LOGIN_ENABLED=false`이다. 활성화하려면 `APPLE_CLIENT_ID`(앱 Bundle ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`(PKCS8 p8 PEM), `APPLE_TOKEN_ENCRYPTION_KEY`(독립적인 32바이트 키의 Base64)가 필요하다. 서버가 5분짜리 ES256 client secret을 생성하고 Apple refresh token은 앱·사용자 식별자에 묶어 AES-GCM으로 암호화한다. 기존 토큰 재암호화 없이 암호화 키를 교체하거나 없애면 계정 삭제 때 Apple 철회를 수행할 수 없으므로 키를 보존한다. 가상 심사 서버는 Apple 기능과 Apple 키 설정을 허용하지 않는다. 운영 DB에는 새 서버 실행 전에 V009·V010을 검증·적용해야 한다.

실제 기기용 App target 빌드에서 다음 두 설정을 함께 지정한다.

- `NEWAVE_APPLE_SIGN_IN_ENABLED=YES`
- `CODE_SIGN_ENTITLEMENTS=App/AppleSignIn.entitlements`

`AppleSignIn.entitlements`는 `com.apple.developer.applesignin`의 `Default`만 선언한다. 기본 Xcode 프로젝트는 이 파일을 서명에 적용하지 않으므로 기존의 인증서 없는 시뮬레이터 CI를 계속 사용할 수 있다. 위 설정만 바꾸어도 실제 인증이 되는 것은 아니며 올바른 Apple 팀·인증서·프로필과 서버 설정이 모두 필요하다. 모든 target에 전역 적용하지 말고 실제 App target 서명 설정에 적용한다.

## 확인 범위

Node 검사는 state 불일치·인가 코드 누락·취소 후 재시도·만료·중복 실행·기기 증명 연결·등록 시 명시적 이메일 유지·계정 연결 응답을 확인한다. iOS 검사는 요청 nonce/state·scope와 잘못된 입력 거부, 기본 비활성 앱의 호출 거부 및 시스템 버튼 그림 생성까지 확인한다. 이 검사는 Apple 실제 로그인을 대신하지 않는다.

외부 철회 검사는 시작·복귀·알림 이벤트, 네트워크 오류, 다른 인증 방식, 새 로그인과 늦은 응답의 경합, 토큰 갱신 중 메타데이터 보존, 이벤트 구독 해제를 포함한다. 네이티브 알림 관찰자는 약한 참조를 사용하고 해제될 때 구독을 제거한다. 실제 Apple 서버와 기기 사이의 철회·계정 삭제 전달은 TestFlight에서 별도로 검증한다.

Apple 개발자 계정을 설정한 뒤에는 **서버 간 알림 수신 주소 등록·서명 검증·재전송 방지·동의 철회/Apple 계정 삭제 처리**도 구현·검증해야 한다. 현재 클라이언트 감시는 다른 기기가 실행되지 않거나 통신되지 않는 상황의 서버 세션 철회를 대신하지 않는다. 계정의 Services ID 사용 여부와 한국 개발자 계정의 알림 등록 조건도 실제 계정에서 확인한다. 이 절차를 끝내기 전에 Apple 로그인을 정식 출시 완료로 표시하지 않는다.

TestFlight 단계에서는 최초 동의, 다음 로그인에서 이름·이메일 누락, 이메일 가리기, 취소, 기존 교사 계정 연결, 신규 가입 승인 대기, 계정 삭제 후 Apple 연결 철회를 실제 iPhone과 가상 앱 계정으로 확인해야 한다. 실제 학생·교사 자료로 인증·삭제 검수를 진행하지 않는다.

실제 Apple 기능을 활성화하기 전에는 Apple 사용자 식별자·암호화된 갱신 토큰의 처리 목적·보관·철회, Apple의 외부 인증 처리를 개인정보처리방침과 App Store 개인정보 신고에 반영한다. 현재 비활성 상태의 코드 준비를 실제 Apple 개인정보 수집·스토어 출시 완료로 표시하지 않는다.

근거: [Apple nonce API](https://developer.apple.com/documentation/authenticationservices/asauthorizationopenidrequest/nonce), [Apple 로그인 버튼 지침](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple), [인증 상태 변화 처리](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts).
