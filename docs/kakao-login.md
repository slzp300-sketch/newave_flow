# 카카오 로그인

기존 이메일 로그인과 회원 ID를 유지한다. 기존 회원은 이메일로 로그인한 뒤 **내 정보 → 카카오 계정 연결**에서 현재 비밀번호로 본인을 확인한다. 카카오 계정을 연결해도 출석·TTS·반 배정·권한·비밀번호는 바뀌지 않는다. 카카오 로그인 버튼과 연결 버튼은 카카오 공식 노란색(`#FEE500`)과 검은 심볼을 사용한다.

아직 연결된 회원이 없는 카카오 계정에는 기존 이메일 계정 연결과 신규 가입 신청을 안내한다. 이메일이 같다는 이유로 자동 연결하지 않는다. 신규 신청은 이름·이메일·비밀번호를 입력한 비활성 `TEACHER` 계정으로 저장하며, 기존 관리자 승인 절차를 통과하기 전에는 이메일과 카카오 모두 로그인할 수 없다. 모든 신규 회원에게 이메일 로그인 수단을 유지한다.

## 카카오 앱 설정

- 앱: **Newave Flow**, ID `1606088`
- 회사: 제자광성교회 뉴웨이브 청소년부
- 카테고리: 교육
- 대표 도메인: `https://newave-flow.vercel.app`
- 카카오 로그인 활성화, Client Secret 활성화
- REST API 키의 카카오 로그인 리다이렉트 URI:
  - `https://newaveflow-production.up.railway.app/api/auth/kakao/callback`
  - `http://localhost:8080/api/auth/kakao/callback`
- 회원번호만 사용한다. 카카오 이메일·전화번호·프로필 조회 권한은 필요하지 않다.
- 연결 해제 웹훅: `POST https://newaveflow-production.up.railway.app/api/auth/kakao/unlink` (2026-10-13 등록 완료).

## 서버 환경변수

키는 비공개 환경변수로만 설정한다. 프런트의 `VITE_*` 변수, Git, 공유 문서에 저장하지 않는다.

| 변수 | 용도 |
|---|---|
| `KAKAO_LOGIN_ENABLED` | 기본 `false`. DB 전환과 키 설정 완료 후 `true` |
| `KAKAO_APP_ID` | 앱 ID `1606088` |
| `KAKAO_REST_API_KEY` | 해당 앱의 대표 REST API 키 |
| `KAKAO_CLIENT_SECRET` | 카카오 로그인 Client Secret |
| `KAKAO_ADMIN_KEY` | 연결 해제 웹훅 인증에 사용하는 대표 어드민 키 |
| `KAKAO_REDIRECT_URI` | 카카오에 등록한 서버 콜백 URI |
| `KAKAO_WEB_RETURN_URI` | 웹 화면 복귀 URI. 운영 기본값 `https://newave-flow.vercel.app/auth/kakao/callback` |

개발 서버는 콜백 URI를 `http://localhost:8080/api/auth/kakao/callback`, 웹 복귀 URI를 `http://localhost:5173/auth/kakao/callback`으로 지정한다. HTTPS 외 주소는 localhost/127.0.0.1의 HTTP만 허용한다.

## 인증과 앱 복귀

OAuth `state`는 요청마다 생성하며 서버에는 해시만 보관한다. 카카오 인가 코드와 토큰 교환은 서버에서 수행한다. 카카오 토큰·프로필은 저장하지 않으며 계정 연결용 회원번호만 보관한다.

웹과 Android는 요청을 시작한 기기에 비밀 verifier를 보관하고 서버에는 SHA-256 challenge를 전달한다. 콜백의 일회용 티켓은 verifier가 있어야 사용할 수 있다. URL에 앱 JWT·비밀번호를 넣지 않는다. 티켓은 사용 후 폐기하며 요청 만료는 10분이다. 만료 요청은 주기적으로 정리한다. 이는 서비스 자체의 앱 복귀 검증이며 카카오의 PKCE 파라미터를 사용하는 방식은 아니다.

Android는 `@capacitor/browser`로 인증 화면을 열고 `newaveflow://auth/kakao#flow=…&ticket=…`로 앱에 복귀한다. 정확한 호스트·경로와 두 파라미터만 허용하며 다른 주소·JWT 전달 URL은 처리하지 않는다. verifier는 기존 기기 보안 저장소에 보관한다.

카카오 연결 해제 웹훅은 대표 어드민 키와 앱 ID를 모두 검증한다. 해당 카카오 회원번호의 임시 인증 요청과 계정 연결을 제거하고 기존 세션을 취소한다. 이메일 계정과 교회 업무 기록은 유지한다. 실제 계정 삭제 절차는 별도로 유지하며, 검토된 삭제 SQL도 카카오 회원번호와 관련 임시 인증 요청을 정리한다.

## DB 전환과 배포

**기능이 비활성인 상태여도 새 서버는 V006 스키마를 필요로 한다. main 자동 배포 전에 DB 전환을 완료해야 한다.**

1. 최신 운영 백업을 접근 제한된 별도 PostgreSQL에 복원한다. 실제 회원·학생 자료와 접속값은 출력하지 않는다.
2. 복원본에서 `backend/db/migrations/V006__kakao_login.sql`의 실패 롤백·정상 적용·재적용 차단·기존 행 해시 보존을 검증한다. `KakaoMigrationTest`는 localhost의 `newave_kakao_*` 이름을 가진 별도 DB만 허용한다. 복원본에는 `KAKAO_SYNTHETIC_FIXTURE=false`를 사용한다.
3. `prod`, `ddl-auto=validate`, 초기화 비활성 설정으로 새 서버가 복원본에 기동되는지 확인한다.
4. 사용자와 PR/main 반영 방법을 정한 뒤 운영에 V006을 적용하고 서버·웹을 배포한다. 비공개 서버 키와 웹훅을 설정한 후 기능을 활성화한다.
5. 운영에서는 실제 회원의 가입·승인·출석 저장을 시험하지 않는다. 허가된 검수 계정 외에는 화면·오류만 확인한다. Android 업데이트 APK는 기존 서명 키로 서명한다.

V006은 nullable 회원번호와 빈 인증 요청 테이블만 추가하며 기존 값을 변경하지 않는다. 코드 롤백 시 추가 스키마를 유지하고 `KAKAO_LOGIN_ENABLED=false`로 이메일 로그인을 계속 사용할 수 있다. 새 운영 기록이 생긴 뒤 과거 백업을 덮어쓰지 않는다.

## 검증

- H2 인증 검사: 기존 회원 기록 보존, 중복 연결 차단, 이메일 자동 연결 금지, 일회용 티켓·기기 verifier·계정 일치·세션 변경·만료 검사, 신규 승인 대기, 인증된 연결 해제, 비밀번호 입력 제한.
- 별도 PostgreSQL: V006 실패 롤백·기존 열/업무 기록 해시 일치·재적용 차단·회원번호 중복 차단·운영 스키마 기동. 계정 삭제 검사에서 관련 요청만 제거하고 다른 회원과 공동 기록을 보존한다.
- 프런트: 정확한 Android 복귀 주소, 잘못된 주소·중복 파라미터·만료 proof 차단. 375px 로그인·내 정보 화면에서 버튼 색상과 배치를 확인한다.
- 실제 카카오 앱: 이 PC의 가상 Local Admin 계정에 연결하고 카카오 재로그인으로 동일 계정에 복귀하는 것을 확인한다. 운영 배포 확인과는 별도이다.

명세: [카카오 REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api), [설정하기](https://developers.kakao.com/docs/ko/kakaologin/prerequisite), [웹훅](https://developers.kakao.com/docs/ko/kakaologin/callback), [디자인 가이드](https://developers.kakao.com/docs/ko/kakaologin/design-guide), [Capacitor Browser](https://capacitorjs.com/docs/apis/browser).

## 운영 DB 적용 확인 (2026-10-13)

최신 운영 PostgreSQL 백업을 Windows 사용자 DPAPI로 암호화해 OneDrive 밖의 접근 제한 폴더에 보관했다. 별도 PostgreSQL 18.6 복원본의 34개 테이블·2,176개 행 해시가 원본 스냅샷과 일치했다. 복원본에서 V006 실패 롤백·정상 적용·재적용 차단·기존 값 보존과 `prod`, `ddl-auto=validate` 기동 검사를 통과했다.

이후 승인된 운영 V006 적용 전후 기존 33개 업무 테이블의 건수·행 해시가 모두 일치했다. 추가된 카카오 회원번호는 전부 NULL이고 임시 인증 테이블은 비어 있다. TLS 서버 인증서 확인에 사용한 임시 Railway SSH 키는 확인 직후 등록 해제하고 이 작업에서 만든 개인 키도 제거했다. 운영 서버·웹 배포와 실제 운영 로그인 확인은 이 DB 적용과 별도로 확인한다.

## 운영 배포와 Android 업데이트 완료 (2026-10-13)

- 사용자 승인으로 [c967789](https://github.com/slzp300-sketch/newave_flow/commit/c96778984290e72a030d8227360c5e30ec642516)을 main에 반영했다. 동일 커밋의 Vercel·Railway 배포가 모두 성공했다.
- [CI 38349091609](https://github.com/slzp300-sketch/newave_flow/actions/runs/38349091609)의 backend, frontend, Android, PostgreSQL 17·18 다섯 작업이 모두 성공했다.
- 운영 health 정상, 카카오 설정 `enabled=true`, 로그인 화면의 노란 버튼 `rgb(254,229,0)`과 375px 배치를 확인했다. 기존 PWA 탭은 새 버전 다시 열기를 거쳐 갱신했다.
- 사용자의 별도 운영 인증 검사 승인 후 실제 카카오 인증으로 ‘계정 연결 또는 가입 신청’ 화면에 진입했다. 운영 회원 계정 연결·신규 가입 제출·관리자 승인·업무 기록 저장은 검사하지 않았다. 기존 계정 연결과 동일 회원 재로그인은 앞서 가상 Local Admin에서 검증했다.
- Galaxy Note9(SM-N960N)에 기존 서명으로 `adb install -r` 성공. 최초 설치 시각 `2026-10-12 21:59:20` 유지, 갱신 시각 `2026-10-13 14:12:17`, 설치 APK 전체 해시와 준비한 c967789 APK 일치를 확인했다. 앱 프로세스 실행도 확인했다. 사용자의 실제 로그인 상태·화면 체감은 별도 확인 대상이다.
- 작업용 DB 복원본과 임시 접속값·카카오 키 복사본을 정리했다. 암호화 백업과 복원·V006 검증 근거는 `C:/Users/upup0/AppData/Local/NewaveFlow/Backups/2026-10-13-kakao`에 현재 사용자/SYSTEM만 접근하도록 보존했다. DPAPI 백업 복호화에는 이 Windows 사용자 환경이 필요하다.
- 운영 인증 및 콘솔 증빙: `frontend/.verification/kakao-registration/production-kakao-auth-success.png`, `production-webhook-configured.png`. 업데이트 파일: 같은 폴더의 `newaveflow-c967789-update.apk`.
