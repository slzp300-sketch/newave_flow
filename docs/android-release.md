# Android 출시 준비

2026-10-12 사용자 요청으로 Android를 먼저 진행한다. 개인 Play 계정은 존재하지만 본인·기기·전화번호 인증이 필요하며, 현재 사용자가 신원 확인을 신청한 상태다. 계정 승인 및 Play 등록은 코드 빌드와 별개다.

## 앱 구성

- 이름: Newave Flow, 임시 확정 패키지: `app.newaveflow.mobile`, 최초 버전 1.0.0 (1).
- React 화면을 Capacitor 8에 포함하며 기존 Railway API를 사용한다. 서버에 새로 허용한 출처는 정확히 `https://localhost` 하나다.
- Android 7.0/API 24 이상, 컴파일·타깃 API 36, JDK 21, Node 24.
- native 모드에서는 PWA 서비스워커를 생성·등록하지 않는다. 웹 모드의 기존 업데이트 흐름은 유지한다.
- Android Keystore AES/GCM으로 로그인 상태를 암호화한다. 평문 localStorage로 우회하지 않는다. 쓰기를 직렬화해 토큰 갱신 후 로그아웃 순서를 보존한다.
- Android 백업·기기 전송에서 앱 데이터를 제외한다. 인터넷 권한만 요청한다. 기존 사진 선택은 시스템 파일 선택기를 사용한다.
- 홈·로그인에서 뒤로 가기를 누르면 앱을 최소화하고, 내부 화면에서는 이전 화면으로 이동한다. 저장 중에는 이동을 보류하고 열린 네이티브 dialog가 있으면 먼저 닫는다.
- 버전 업데이트로 설치된 앱을 되돌리는 기능은 없다. 서버는 기존 설치 앱과 호환을 유지해야 한다.

## 빌드

```powershell
$env:JAVA_HOME = 'JDK 21 설치 경로'
$env:ANDROID_HOME = 'Android SDK 설치 경로'
./tools/android/build.ps1
./tools/android/build.ps1 -Configuration Release
```

최초 개발 환경에서는 Google 공식 SDK 명령행 도구를 `frontend/.verification/android-sdk`에 설치했고 공식 SHA-256을 대조했다. SDK·Gradle 캐시와 키는 Git에 포함하지 않는다. 다른 PC에서는 Android Studio 또는 공식 SDK로 환경을 준비한다.

- 디버그 APK: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- 릴리스 번들: `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- 위 릴리스 번들은 별도 서명 설정 전에는 **미서명**이다. Play에 올릴 최종 파일로 취급하지 않는다.
- 릴리스 업로드 키와 안전한 복구본, Play App Signing을 준비한 뒤 내부 테스트에 제출한다. 패키지 이름은 첫 업로드 후 변경할 수 없으므로 첫 업로드 전에 최종 확인한다.

## 출시 전에 반드시 확인

- [ ] Play 본인·Android 기기·전화번호 인증 완료와 앱 생성 가능 여부
- [ ] 해당 개인 계정에 12명/14일 비공개 테스트 요건이 적용되는지 콘솔 확인
- [ ] 실제 Android 설치·로그인·앱 재시작·토큰 만료/갱신 검수
- [ ] TTS 체크/통계, 공동 출석, 행사 대상/접수 기간, 일정 확인 동기화 검수
- [ ] 키보드·뒤로 가기·팝업·사진 선택·접근성·오프라인/재연결·앱 업데이트 검수
- [ ] 사용자 소유 릴리스 서명 키 준비 및 안전한 백업
- [ ] 개인정보 처리방침 확정, 데이터 보안 양식, 연령/대상, 배포 지역
- [ ] 가상 자료로 된 심사 계정과 스크린샷, 실데이터에 접근하지 않는 심사 경로
- [ ] 탈퇴 처리 절차의 가상 데이터 검증 및 백업 보관 기한 확정

## 지원·삭제 요청

사용자가 공개를 승인한 담당 이메일은 `slzp300@gmail.com`이다. `/support`, `/account-deletion`은 로그인 없이 접근할 수 있다. 로그인 화면과 내 정보에서 같은 안내에 접근한다. 메일 작성 버튼만 누르면 접수된 것처럼 표시하지 않으며 직접 전송해야 한다. 현재 접수·본인 확인·처리는 **운영자 이메일 방식**이며 자동 삭제 API가 구현됐다는 의미가 아니다.

사용자 결정: 본인 확인 후 계정·연락처·프로필·개인 TTS 기록 삭제, 공동 반 보고서는 식별 정보를 제거한 뒤 보존. 실제 삭제 요청을 처리하기 전 `account-deletion-runbook.md`에 따라 복원본에서 먼저 검증한다.

## 보안 검사

Capacitor 도입 시 발견한 실행용 axios/form-data의 높은 등급 경고는 호환 업데이트로 해소했다. React Router 6의 중간 등급 경고 두 개는 남아 있다. 보고 항목은 SSR 오류 복원과 비정상 경로 리디렉션이며, 현재 앱은 SSR을 사용하지 않고 화면 경로는 코드에서 생성한다. 범위 검토와 Router 7 전환 검증은 정식 출시 전에 완료한다. 개발 도구의 npm audit 전체 경고도 실행용 경고와 구분해 검토한다.

## 공식 근거

- [Capacitor 환경](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Android Keystore](https://developer.android.com/privacy-and-security/keystore)
- [Google 계정 삭제](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google 개인 계정 테스트](https://support.google.com/googleplay/android-developer/answer/14151465)

## 1차 로컬 검수 결과 (2026-10-12)

- 프런트 65개 자동 검사와 웹/native 빌드, 백엔드 전체 build 통과.
- Android `assembleDebug bundleRelease lintDebug` 통과. 디버그 APK 서명 검증 통과, 1.0.0 (1), 최소 API 24 / 타깃 API 36 확인.
- 릴리스 AAB는 아직 업로드 키로 서명하지 않았다. 실제 휴대폰 연결·설치·로그인·KeyStore 동작은 미검증이다.
- 로그인·고객지원·탈퇴 요청을 375px에서 검수했다. 가로 넘침과 콘솔 오류가 없고 로그인 보조 버튼은 44px 이상이다. 메일 수신 주소와 직접 전송 안내를 대조했으며 시험 메일은 보내지 않았다.
- lint의 Android 12 미만 백업 경고에 따라 `fullBackupContent=false`도 명시했다. 나머지 아이콘 밀도·형태/단색 아이콘, 템플릿 미사용 리소스 및 새 의존성 버전 경고는 출시 전에 정리한다. 검사 성공이 경고 0개를 의미하지 않는다.
- 가상 자료 기반 삭제 실행, 개인정보 처리방침과 백업 보관 기한, 서명 키, 실기기·심사 계정 검증은 남아 있다.
- 현재 변경은 로컬 준비본이며 운영 배포·Play 업로드는 아직 하지 않았다. 운영 API의 native 출처 허용 배포가 끝나야 설치 앱의 서버 연결을 검수할 수 있다.

빌드 성공, 실제 기기 성공, 내부 테스트 배포, 정식 스토어 출시는 각각 별도로 기록한다.

## 후속 설치·운영 배포 (2026-10-12)

- `5eb68fc` main 반영 후 Vercel·Railway 배포 성공. Android 출처 `https://localhost`의 운영 로그인 API 사전 요청 허용 확인.
- Galaxy Note9(SM-N960N), Android 10에 Newave Flow 1.0.0(1) APK 설치 성공. 사용자 확인으로 로그인 화면 표시까지 통과했다. 로그인·재실행 유지 및 나머지 실기기 항목은 별도 확인한다.
- 스토어 설명, 아이콘, 그래픽, 가상 자료 화면 4장, 개인정보 처리방침·데이터 보안 초안은 `android-store/README.md` 참고. 개인정보 처리방침 확정·공개, 안전한 심사 환경, 업로드 키 서명과 Play 제출은 아직 완료하지 않았다.
- 첫 원격 Android 검사에서 SDK 관리 명령을 찾지 못한 문제를 확인해 `android-actions/setup-android`를 추가했다. 로컬 Android 빌드 성공과 원격 검사 성공을 구분한다.
- 수정 커밋 `a4ebe6a`의 [원격 검사](https://github.com/slzp300-sketch/newave_flow/actions/runs/38253987144) 5개가 모두 통과했다. Android APK/AAB 생성·lint·결과물 업로드 성공을 확인했다.
- 사용자 실기기 후속 확인: 로그인과 홈 통계 표시, 앱 완전 종료 후 로그인 유지, 내 상세 통계·일정·출석·행사 조회 및 휴대폰 뒤로가기 복귀가 모두 정상이다. 운영 기록을 시험 저장하지 않았다. 남은 실기기 시나리오는 `android-store/review-instructions.md`에 구분했다.
