# 비공개 테스트 준비 — 다른 PC 인계

2026-10-13, Windows `C:\Users\user\newave_flow`에서 확인. 사용자는 기존 Play 업로드 키를 지금 이전할 수 없어 이 PC의 진행 중인 스토어 작업을 마무리하고 다른 PC에서 이어가기로 했다. **비공개 테스트는 아직 시작하지 않았다.** 아래 Console 상태와 이전 개발 이력을 구분한다.

## 이번에 완료한 작업

| 항목 | 저장/점검 결과 |
| --- | --- |
| 광고 | 광고 없음 저장 |
| 정부 앱 | 정부 앱 아님 저장 |
| 금융 기능 | 금융 기능 없음 저장 |
| 건강 기능 | 의료·건강관리 기능 없음 저장. 건강정보 수집 없음이라는 뜻이 아님 |
| 카테고리·연락처 | 생산성, `slzp300@gmail.com`, `https://newave-flow.vercel.app/support` 게시 확인. 전화번호 임의 추가 없음 |
| 한국어 등록정보 | 앱명 뉴웨이브 플로우, 짧은 설명 48자·상세 설명 577자, 아이콘·그래픽·스크린샷 4장 저장 |
| Console 결과 | **6/11 완료**, 스토어 상태 **검토를 위해 전송 준비 완료**. Google 검토 전송은 미실행 |
| 새 화면 자료 | `screenshots-20261013/`의 홈·개인 TTS·출석·일정 순서. 실제 React 웹 화면과 온라인 가상 심사 데이터로 캡처 |
| 화면 기능 검수 | 가상 교사 오늘 말씀 체크 10→15점 저장, 개인 통계 15점 반영, 일정·출석 표시. 확인한 흐름 콘솔 오류 0건 |

스크린샷은 각 390×693 JPEG이며 실기기 원본이라고 표시하지 않는다. 업로드/저장은 통과했고 Google 추천 영역용 고해상도 조건 및 최종 AAB 화면 대조는 별도다. 실제 학생·교사 자료를 캡처하거나 시험 저장하지 않았다. 앱 소스·운영 DB·배포 설정은 이번 스토어 정리에서 변경하지 않았다.

## 현재 서버·앱 버전

- 기준 main: `5c080b7`(문서), TTS 최적화 기능 `df99847`. 이전 프런트 73개, 백엔드 실행 62개 검사 통과; 외부 PostgreSQL용 7개는 로컬에서 건너뛰고 GitHub 별도 작업 통과. 이번 문서/이미지 변경으로 이 검사를 다시 실행한 것은 아니다.
- 100명 합성 부하: 7,302요청·502개 결과 확인 통과, TTS 통계 p95 3,406.6ms → 1,062.9/743.6ms. 로컬 PostgreSQL 검수이며 운영 100명 수용을 보장하는 측정은 아니다. [성능 기록](../tts-statistics-performance-2026-10-13.md).
- 운영 API: `https://newaveflow-production.up.railway.app/api`.
- 심사 API: `https://newave-review-production.up.railway.app/api`. 별도 `review` 프로필/H2/전용 `/data` 볼륨. 온라인 기능 21개·재시작 후 20개 검증 완료. 운영 `/auth/review-config`가 이 심사 API를 안내한다.
- 심사 서비스는 **CLI로 허용 목록 소스만 업로드**한다. main 푸시만으로 심사 서버가 자동 갱신되지 않는다. [배포 기록과 격리 기준](review-environment.md).
- Play 내부 테스트 활성 버전은 **1.0.0(1)**. **1.0.0(2) · e95b734**는 업로드된 초안이며 게시하지 않았다. 새 개인정보 처리방침 링크를 포함한 빌드가 필요하다.
- Capacitor 앱은 웹 파일을 AAB에 포함한다. 운영 웹만 바꾸면 설치된 앱 UI도 즉시 바뀐다고 가정하지 않는다.
- 이 PC의 운영 웹 브라우저에서 이전 로그인 구성이 보인 관찰이 있었다. 캐시/서비스워커/배포 중 어느 원인인지는 확정하지 않았다. 재개 PC에서 배포 커밋과 실제 빌드 버전을 확인한다. 이번 새 스크린샷은 최신 로컬 React 코드다.

## 개인정보 관련 새 답변

1. 학생·보호자에게 최초 방문 시 안내하고 직접 정보를 받았지만 **별도 동의 기록은 없다**. 서면 동의, 민감정보 별도 동의, 국외 이전 동의가 완료됐다고 임의 기재하지 않는다.
2. 기도제목·출결 사유 등에 **건강·상담 내용이 기록된다**. 데이터 보안의 건강정보와 처리방침에 반영한다. 모든 상담 내용을 의학 정보라고 단정하지 않되 실제 건강 내용은 제외하면 안 된다.
3. **만 14세 미만 포함 여부는 미확정**이다. 교사 이용 대상이 18세 이상인 것과 학생 정보주체의 나이는 별개다.
4. 기존 안내문/방법, 실제 수집 항목, 민감정보 처리 근거, 법정대리인 절차, 권한·최소 수집·기간, 해외 처리 세부 사항을 확인한다. 필요한 추가 안내·동의는 실제 확인 날짜와 선택으로 기록하며 과거 자료를 일괄 동의 처리하지 않는다.
5. 승인된 보관 기간은 유지한다. 교사 계정·TTS는 이용 중/탈퇴 시 삭제, 학생·보호자는 졸업·전출 인계 후 90일 이내, 행사 개인 응답 1년, 문의 완료 후 90일, 공동 문서 3년 후 필요성 검토. 삭제 목표 7일, 암호화 백업 30일 및 PC 다음 실행 시 만료 정리. 기존 자료 일괄 삭제는 하지 않는다.

근거 문서: [처리방침 초안](privacy-policy-draft.md), [데이터 보안 초안](data-safety-draft.md), [운영 결정](../privacy-decisions-2026-10-12.md), [안내·동의 준비본](../privacy-consent-templates.md), [삭제 절차·가상 검수](../account-deletion-runbook.md).

Railway 운영 서버/DB 미국 지역은 확인했으나 Vercel/Gmail 등을 포함한 모든 계약·국가·항목·로그 기간을 확정한 것은 아니다. 지원/계정 삭제 공개 페이지는 있고 `/privacy` 및 앱 내 방침 링크는 아직 없다. 초안을 그대로 확정 방침으로 게시하지 않는다.

## 다른 PC에서 진행할 순서

### 1. 코드와 개발 환경

작업 폴더에서 `git status --short`로 기존 변경을 확인한다. 깨끗한 main이면 `git pull --ff-only origin main`; 변경/분기가 있으면 먼저 보존하고 차이를 검토한다. 강제 reset/clean으로 디자인 자료·키를 지우지 않는다. 이 문서와 `screenshots-20261013/`가 내려왔는지 확인한다.

Node 24, JDK 21, Android SDK platform 36/build-tools 36.0.0을 사용한다. 다른 PC의 기존 SDK·Java 경로를 그대로 확인하고 이 PC 절대 경로를 복사하지 않는다. `frontend`에서 `npm ci`. 운영 마이그레이션 V001~V007을 재실행하지 않는다.

### 2. 기존 Play 업로드 키 확인

- 다른 PC의 접근 제한 개인 폴더에 `upload-keystore.p12`, `keystore-password.txt`가 있다. alias는 `newaveflowupload`.
- 업로드 인증서 SHA-256: `6D:11:2B:44:B0:FC:D1:38:5D:06:E2:D5:F5:3F:A7:7F:EB:C9:58:74:84:86:FF:BB:53:B6:30:64:CD:CC:3E:0C`.
- 이 PC에서는 파일을 이전받지 못했고 서명 검증도 못 했다. 새 키 생성/Play 업로드 키 초기화로 대체하지 않는다. 과거 USB 검수 키와 구별한다.
- 비밀번호를 명령 인수/채팅/노션에 적지 않는다. `tools/android/sign-release.ps1`는 암호 파일을 읽는 방식이다. 키·암호·DPAPI를 Git이나 스토어 이미지에 넣지 않는다.

### 3. 처리방침과 앱 링크 완성

위 미확정 내용을 확인해 확정된 공개 HTML `/privacy`를 구현하고 로그인·내 정보 등 앱 안에서 접근 가능하게 한다. 지원·삭제 URL, 설명·기간·현재 삭제 도구가 일치하는지 확인한다. 웹 비로그인/375px, Android 외부 링크·뒤로가기, 기존 로그인/영성체크/출석/행사 흐름을 검수한다.

### 4. 새 Android 빌드와 서명

Console 최대 versionCode를 다시 확인한다. 현재 저장소/업로드본은 2이므로 다음 후보는 **3**이다. 이미 다른 PC에서 3을 썼다면 더 높은 값으로 정한다. 개인정보 링크 없는 기존 버전 2를 최종 준비 완료로 게시하지 않는다.

1. 프런트 `npm test`, `npm run build -- --outDir .verification/build`. 백엔드를 수정했을 때만 해당 build·관련 검사 추가.
2. SDK/JDK 환경 설정 후 루트 `./tools/android/build.ps1 -Configuration Release`. 이 도구는 native sync, bundleRelease와 lintDebug를 실행하므로 최종 릴리스는 `frontend/android/gradlew.bat -p frontend/android lintRelease --no-daemon --console=plain`도 확인한다.
3. 미서명 AAB: `frontend/android/app/build/outputs/bundle/release/app-release.aab`.
4. `./tools/android/sign-release.ps1 -SigningDirectory <기존 키 폴더> -AabPath <미서명 AAB> -OutputPath <별도 서명 AAB>` 실행. 인증서 지문·JAR 검증·SHA-256·빌드 버전과 실제 자료/비밀값 미포함 확인.
5. Google Play 업로드 후 가상 계정/실제 교사 계정 각각의 서버 선택과 실기기 업데이트를 확인한다. 실제 운영 계정은 조회만 하고 저장 시험은 가상 환경에서 한다. 기존 앱 삭제·자료 초기화가 필요하면 사용자와 범위를 먼저 확인한다.

### 5. 심사 로그인 정보와 남은 Console 설정

**현재 온라인 심사 암호는 이 PC에서 새로 만든 값이다. 다른 PC의 예전 준비 암호와 일치한다고 가정하지 않는다.**

- 이 PC 파일: `C:\Users\user\.newave-flow\review-railway\review-access.txt`. 암호 값은 이 문서/노션에 없다.
- 다른 PC에서는 인증된 Railway의 **newave-review** 서비스 `REVIEW_TEACHER_PASSWORD`, `REVIEW_ADMIN_PASSWORD`를 비공개로 확인하거나 기존 접근 파일을 안전하게 이전한다. 운영 서비스 JWT/DB 암호를 가져오지 않는다.
- `review-secrets.dpapi`는 Windows 사용자에 묶인다. 다른 PC로 복사만 해서 복호화할 수 있다고 가정하지 않는다.
- `tools/review/credentials.ps1`를 비어 있는 새 폴더에서 실행하면 새 비밀값을 만들 수 있다. 기존 온라인 암호를 복구하는 명령이 아니다. 불필요하게 온라인 자격증명을 덮어쓰지 않는다.
- 심사 ID: `play.teacher@review.newaveflow.invalid`, `play.admin@review.newaveflow.invalid`. 미리 승인된 가상 계정이며 카카오 인증은 필요 없다. 상단 가상 환경 배너와 가상 학생 8명/반 2개 확인. 저장·관리 기능을 숨기지 않는다.
- Google Play 앱 액세스는 비공개 심사 계정 ID·암호와 사용 안내를 **Google 심사자에게 전달**하는 단계다. 브라우저 도구를 쓰면 해당 데이터와 대상에 대한 승인을 확인한 뒤 등록한다. 공개 설명/노션에는 암호를 쓰지 않는다.
- 타겟층: 사용자 확정 기준 **18세 이상 교사·사역 담당자**. Console은 **로그인 세부정보 완료 후** 입력 가능하다고 표시했다.
- 콘텐츠 등급: IARC 설문 첫 화면만 열어봤고 이메일/답변/약관을 제출하지 않았다. 약관 수락은 브라우저 규칙상 **그 시점의 사용자 확인**이 필요하다. 이 인계가 수락 승인은 아니다.
- 데이터 보안: 실제 건강정보·종교 관련 정보·입력 자료·사진·호스팅/로그 등을 반영한다. 처리방침 URL, 계정 삭제 외부 URL, 암호화·서비스 제공자 예외를 증거와 대조한다.

### 6. 비공개 트랙·12명 테스트

테스터는 실제 뉴웨이브 교사 약 12명이며 Google Play 이메일은 다음 주 수집 예정이다. 아직 명단 등록/참여 링크 배포/비공개 시작은 하지 않았다. 단순히 인원을 구한 상태를 12명 참여 완료로 계산하지 않는다.

앱 설정 11개·새 AAB·심사 접근을 마친 뒤 비공개 트랙과 대상 국가/테스터 목록을 설정하고 검토에 전송한다. 실제 표시되는 지역 범위를 확인하며 기본 전체 국가로 임의 확장하지 않는다. Google 검토 완료·버전 제공 확인 후 해당 Google 계정으로 참여 → Play 설치 → 본인 뉴웨이브 로그인 순서로 안내한다. 기존 내부 테스트 참여자는 비공개로 옮기기 전 내부 참여 종료를 확인한다.

출시 요건은 **12명 이상이 연속 14일 비공개 테스트에 참여한 상태**다. 내부 테스트 기간은 합산하지 않는다. 중도 이탈에 대비한 여유 인원과 실제 피드백/수정 기록을 준비한다. Google 검토·프로덕션 액세스 승인 날짜를 보장하지 않는다.

## 연결 주소와 기록

- [Play 대시보드](https://play.google.com/console/u/0/developers/8210423266953776729/app/4976215546588082744/app-dashboard)
- [작업 로그](https://www.notion.so/3f8d9f3bd74f81e48b55eb343c3e10f6)
- [교사 테스트 안내 준비본](teacher-closed-test-plan.md)
- [Google 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Google 사용자 데이터 정책](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google 데이터 보안 기준](https://support.google.com/googleplay/android-developer/answer/10787469)

다음 PC의 시작 요청 예시: “최신 main과 `docs/android-store/closed-test-handoff-2026-10-13.md`, 노션 로그를 대조한 뒤 개인정보 처리방침·앱 링크부터 이어서 진행해줘. 기존 Play 업로드 키는 이 PC에 있어. 온라인 심사 암호와 예전 로컬 준비 암호를 구분하고 단계마다 검수·기록해줘.”
