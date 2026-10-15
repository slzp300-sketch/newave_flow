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

서버 기본값은 `APPLE_LOGIN_ENABLED=false`, `APPLE_NOTIFICATIONS_ENABLED=false`이다. 활성화하려면 `APPLE_CLIENT_ID`(앱 Bundle ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`(PKCS8 p8 PEM), `APPLE_TOKEN_ENCRYPTION_KEY`(독립적인 32바이트 키의 Base64)가 필요하다. 서버가 5분짜리 ES256 client secret을 생성하고 Apple refresh token은 앱·사용자 식별자에 묶어 AES-GCM으로 암호화한다. 기존 토큰 재암호화 없이 암호화 키를 교체하거나 없애면 계정 삭제 때 Apple 철회를 수행할 수 없으므로 키를 보존한다. 가상 심사 서버는 Apple 로그인·알림 기능과 Apple 키 설정을 허용하지 않는다. 기존 기본 앱에는 V009·V010이 필요하며, V011은 알림 기능 활성화 전 별도 검증·적용하는 준비 마이그레이션이다.

로그인 기능은 알림 기능이 꺼져 있으면 시작을 거부한다. 알림만 켜 두고 로그인을 일시 중지하는 것은 가능하다. 알림 활성화 시 PostgreSQL의 V011 버전과 필수 열이 없으면 서버가 시작하지 않는다. 두 기능이 모두 꺼져 있으면 V011 테이블에 접근하지 않아 기존 `prod`의 `ddl-auto=validate`를 계속 사용할 수 있다. 이 검사는 Apple 포털에 주소가 등록되었음을 확인해 주지는 않으므로 포털 설정과 실제 알림 도착 확인도 활성화 조건이다.

실제 기기용 App target 빌드에서 다음 두 설정을 함께 지정한다.

- `NEWAVE_APPLE_SIGN_IN_ENABLED=YES`
- `CODE_SIGN_ENTITLEMENTS=App/AppleSignIn.entitlements`

`AppleSignIn.entitlements`는 `com.apple.developer.applesignin`의 `Default`만 선언한다. 기본 Xcode 프로젝트는 이 파일을 서명에 적용하지 않으므로 기존의 인증서 없는 시뮬레이터 CI를 계속 사용할 수 있다. 위 설정만 바꾸어도 실제 인증이 되는 것은 아니며 올바른 Apple 팀·인증서·프로필과 서버 설정이 모두 필요하다. 모든 target에 전역 적용하지 말고 실제 App target 서명 설정에 적용한다.

## 확인 범위

Node 검사는 state 불일치·인가 코드 누락·취소 후 재시도·만료·중복 실행·기기 증명 연결·등록 시 명시적 이메일 유지·계정 연결 응답을 확인한다. iOS 검사는 요청 nonce/state·scope와 잘못된 입력 거부, 기본 비활성 앱의 호출 거부 및 시스템 버튼 그림 생성까지 확인한다. 이 검사는 Apple 실제 로그인을 대신하지 않는다.

외부 철회 검사는 시작·복귀·알림 이벤트, 네트워크 오류, 다른 인증 방식, 새 로그인과 늦은 응답의 경합, 토큰 갱신 중 메타데이터 보존, 이벤트 구독 해제를 포함한다. 네이티브 알림 관찰자는 약한 참조를 사용하고 해제될 때 구독을 제거한다. 실제 Apple 서버와 기기 사이의 철회·계정 삭제 전달은 TestFlight에서 별도로 검증한다.

## 서버 간 알림

수신 주소는 `POST /api/auth/apple/notifications`이다. Apple 포털의 주 App ID에 HTTPS 전체 주소를 등록하며 TLS 1.2 이상이 필요하다. 현재 구현은 `APPLE_CLIENT_ID` 하나만 대상으로 검증한다. 앱 그룹이나 Services ID를 추가할 때 허용 대상을 임의로 넓히지 말고 실제 Apple 알림의 대상 식별자를 확인해야 한다.

요청은 JSON `{ "payload": "Apple이 서명한 JWS" }` 형식이다. 고정 Apple JWKS에서 받은 RSA 키로 RS256 서명을 먼저 확인하고 `iss=https://appleid.apple.com`, 정확히 일치하는 단일 `aud`, `iat`, `jti`, `events.type/sub/event_time`을 검증한다. URL이나 공개 키가 요청 헤더에 들어 있어도 가져오지 않는다. 공식 예제의 `exp`는 없으므로 필수로 요구하지 않지만, 포함된 만료·유효 시작 시각은 검사한다. 시각은 Unix 초 정수로만 받고 60초를 넘는 미래 시각이나 밀리초 값을 거부한다. Apple 문서는 최대 재전송 기간·도착 순서를 보장하지 않으므로 오래된 알림을 일률적으로 버리지 않는다. 임시 키 조회 실패는 재시도 가능한 503, 잘못된 서명·형식은 400, 비활성 수신 주소는 404를 반환한다. 정상·중복 알림은 본문 없는 200과 `Cache-Control: no-store`를 반환한다.

`consent-revoked`는 해당 앱의 Apple 연결을 끊고, `account-deleted`는 해당 Apple 계정의 영구 삭제를 표시한다. 연결된 갱신 토큰 암호문을 지우고 계정의 세션 버전을 한 번 올려 현재 모든 Newave 세션을 종료한다. 현재 세션 구조는 인증 방식별 버전을 나누지 않으므로 이메일·카카오 세션도 다시 로그인해야 한다. **이 알림으로 Newave 사용자·출석·공동 기록을 삭제하거나 앱 계정 삭제 신청을 만들지 않는다.** 이메일·비밀번호 로그인은 그대로 사용할 수 있다. 현재 앱은 Apple 릴레이 이메일을 발송하지 않으므로 `email-enabled`/`email-disabled`는 이메일이나 접근 권한을 바꾸지 않고 확인 응답만 한다. 알 수 없는 서명된 이벤트 유형도 계정 상태를 변경하지 않는다.

V011의 `apple_notification_subjects`는 앱 ID와 Apple 사용자 식별자를 묶은 SHA-256 해시, 연결된 로컬 사용자 ID, 마지막 철회/삭제 시각과 현재 연결의 시작 시각을 보관한다. `apple_notification_receipts`에는 앱 ID에 묶인 `jti` 해시, subject 해시, 검증된 payload 해시와 수신 시각만 보관한다. 원본 JWT·이메일·이름·인가 코드·원본 `jti`를 저장하거나 기록하지 않는다. 같은 `jti`와 같은 내용은 한 번만 반영하고, 같은 `jti`에 다른 내용이 들어오면 거부한다. 처리 기록과 연결·세션 변경은 같은 DB 트랜잭션에서 완료된다.

완료/가입은 flow → subject → 사용자 → Apple 연결 순서로 잠그고, 알림은 subject → 사용자 → 연결 순서로 잠근다. 알림은 flow를 지우지 않고 철회 시각을 남겨 아직 가입을 마치지 않은 이전 인증도 무효화한다. 연결 시각은 서버의 일회성 flow 생성 시각을 보수적 기준으로 사용한다. 철회와 같은 초에 만든 flow는 재시작해야 하며, 더 늦게 새로 만든 flow의 정상 Apple 인증만 인정한다. 동의 철회 후에는 이메일로 로그인하고 현재 비밀번호와 새 Apple 동의로 **같은 Apple 계정**을 다시 연결할 수 있다. 이전 알림이 재전송되거나 뒤늦게 와도 새 연결을 끊지 않는다. Apple 계정 영구 삭제나 Newave 삭제 접수 중인 계정은 이 재연결을 허용하지 않는다.

수신 해시는 30일 후, 연결된 사용자가 없는 subject 상태도 마지막 처리 30일 후 정리한다. 등록용 flow의 유효시간은 5분이므로 이 정리가 유효한 가입 흐름을 없애지는 않는다. 사용자에게 연결된 subject 상태는 최종 앱 계정 삭제까지 보관하고, 해당 사용자 삭제 시 subject와 수신 해시가 함께 제거되도록 외래 키와 운영자 삭제 절차를 구성한다. 30일 후 같은 알림이 다시 오더라도 남아 있는 연결 시각과 최대 철회 시각으로 상태를 뒤집지 않는다. V011 적용 전에는 변경된 운영자 삭제 SQL도 함께 검증해야 한다.

가상 검사는 서명 위조·대상 불일치·시각·중복 및 충돌 `jti`, 재연결 후 지연 알림, 동일 초 경계, 미가입 flow와 철회의 두 동시 처리 순서, 삭제 접수 중 재연결 금지, 기본 비활성 및 가상 심사 격리, 보관 정리를 확인한다. PostgreSQL 별도 검사와 CI는 V011 전체 롤백·재적용 거부·기존 자료 보존·활성화 관문과 실제 행 잠금을 확인한다. 이 결과는 Apple의 실제 전달 성공을 의미하지 않는다.

Apple 개발자 계정 등록 후에는 포털 수신 주소 등록, 실제 동의 철회/영구 삭제 알림의 서명·대상·재전송 응답을 가상 앱 계정으로 확인해야 한다. 클라이언트 감시와 서버 알림을 모두 실제 iPhone/TestFlight에서 검수하기 전에는 Apple 로그인을 정식 출시 완료로 표시하지 않는다.

TestFlight 단계에서는 최초 동의, 다음 로그인에서 이름·이메일 누락, 이메일 가리기, 취소, 기존 교사 계정 연결, 신규 가입 승인 대기, 계정 삭제 후 Apple 연결 철회를 실제 iPhone과 가상 앱 계정으로 확인해야 한다. 실제 학생·교사 자료로 인증·삭제 검수를 진행하지 않는다.

실제 Apple 기능을 활성화하기 전에는 Apple 사용자 식별자·암호화된 갱신 토큰의 처리 목적·보관·철회, Apple의 외부 인증 처리를 개인정보처리방침과 App Store 개인정보 신고에 반영한다. 현재 비활성 상태의 코드 준비를 실제 Apple 개인정보 수집·스토어 출시 완료로 표시하지 않는다.

근거: [Apple nonce API](https://developer.apple.com/documentation/authenticationservices/asauthorizationopenidrequest/nonce), [Apple 로그인 버튼 지침](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple), [인증 상태 변화 처리](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts), [공식 문서 Markdown](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts.md), [서버 간 알림 주소 등록](https://developer.apple.com/help/account/capabilities/enabling-server-to-server-notifications).
