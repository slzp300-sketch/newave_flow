# 출시 추가 검수와 다른 PC 병합 안내

작업: 2026-10-13 밤 ~ 10-14, Windows `user` PC. 기준 커밋은 `0419c2617bd95e296ed731f712bbefe022f1365e`, 작업 브랜치는 `codex/android-release-verification`이다.

## 완료 범위

| 항목 | 확인 결과 | 남은 단계 |
|---|---|---|
| React Router 실행 의존성 보안 | 7.18.4 업데이트, 실행 의존성 audit 0건, 자동 검사 73개 및 주요 웹 흐름 통과 | 다른 PC의 개인정보 변경과 병합 후 최종 웹·앱 빌드/배포 |
| Android 검수 | native 빌드, APK/AAB 생성, debug/release lint, 디버그 APK 서명 검사 통과 | 최종 서명 앱의 실기기 검수 미완료 |
| 운영 웹 버전/캐시 | 앱 내 업데이트 안내 적용 후 내 정보 버전 0419c26 확인 | 이번 보안 수정의 운영 반영은 별도 |

이 표는 Play 설정 완료, 비공개 테스트 시작, 최종 앱 출시를 뜻하지 않는다. 다른 PC의 4개 작업과 합친 결과를 아직 검수하지 않았다.

## 보안 수정

- 변경 파일은 `frontend/package.json`, `frontend/package-lock.json`이다. `react-router-dom`을 기존 선언 `^6.26.2`/잠금 버전 `6.30.6`에서 정확한 `7.18.4`로 올렸다.
- 앱의 기존 `react-router-dom` import 호환 경로를 유지했다. 화면·라우트 정의, 개인정보 문서, native 설정, DB, Play 설정을 수정하지 않았다.
- 공식 취약점: [GHSA-wrjc-x8rr-h8h6](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6), [GHSA-337j-9hxr-rhxg](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg). 앱은 클라이언트 렌더링이며 수동 SSR 오류 복원 기능은 사용하지 않는다. 사용 범위 검토와 별개로 수정 버전으로 전환했다.
- [공식 v6 → v7 안내](https://raw.githubusercontent.com/remix-run/react-router/react-router%407.18.4/docs/upgrading/v6.md)의 Node 20+/React 18+ 요구사항을 대조했다. 현재 Android 제작 환경은 Node 24/JDK 21이다.
- `npm audit --omit=dev --json`: 실행 의존성 **0건**. 전체 `npm audit --json`: **23건(낮음 1, 중간 8, 높음 14)**으로 개발/빌드 도구 경고는 남아 있다. 프로젝트 전체 보안 경고가 0이라는 의미가 아니다.
- 웹 빌드의 초기 JS 청크가 약 508KB, gzip 약 168KB로 500KB 안내가 발생한다. 빌드는 성공했으며, 추가 청크 분리는 별도 성능 개선 후보다.

## 검증 명령과 결과

1. `frontend`에서 `npm test`: **73개 통과**.
2. `npm run build -- --outDir .verification/router7-build`: 웹/PWA 빌드 성공.
3. 루트에서 `tools/android/build.ps1 -Configuration Release`: native 웹 빌드·Capacitor 동기화·`bundleRelease lintDebug` 성공.
4. `frontend/android/gradlew.bat -p frontend/android assembleDebug lintRelease --no-daemon --console=plain`: 성공.
5. 앱 자체 debug/release lint XML: 각각 오류 0, 경고 33. Capacitor 의존성은 기존 baseline에 의해 오류 6개가 제외되었다. 검사 성공을 모든 경고/기존 제외 항목의 해결로 보고하지 않는다.
6. `apksigner verify --verbose`: 디버그 APK v2 서명 검증 성공. Play 업로드 키로 서명한 최종 앱은 아니다.
7. 생성 AAB의 PWA 서비스워커 파일 0개, JAR 서명 항목 0개 확인. native 모드에 PWA 업데이트 파일이 포함되지 않았고, AAB는 미서명 검수본이다.

백엔드 소스·DB가 바뀌지 않아 기존 100명 부하 검사와 DB 전환을 다시 실행하지 않았다. 이 프런트 변경으로 백엔드 전체 검사를 새로 통과했다고 보고하지 않는다.

## 브라우저 회귀 검수

로컬 새 빌드와 이미 배포된 격리 심사 서버를 연결했다. 실제 운영 계정 기록의 저장·제출·삭제는 하지 않았다.

- 가상 교사 이메일 로그인 및 가상 환경 배너 표시.
- 오늘 기도 체크: 주간 점수 15→20, 저장 완료 표시, TTS 개인 통계에 20점 반영. 홈에서 체크를 해제해 원래 15점 상태로 복원했다.
- TTS 개인 추이의 query string 이동, 출석 제출 결과/수정 모드 열기, 행사 대상·접수 기간·교사/학생 제출 결과 표시.
- 로그아웃 후 `/attendance` 직접 접근 시 `/login`으로 이동하는 보호 경로 확인.
- 가상 관리자 로그인 → 관리자 메뉴 → TTS 관리 → 일정 목록 → 브라우저 뒤로가기 확인.
- 일정 목록에서 서버 응답 후 가상 일정 2개 표시, 확인한 흐름의 새 콘솔 오류/경고 없음.
- 일정 목록은 응답 대기 중에 ‘등록된 일정이 없습니다’를 먼저 보여준다. 자료 누락이 아니라 로딩/빈 상태 구분의 기존 UX 개선점으로 기록한다. 이번 의존성 변경 범위를 넓혀 수정하지 않았다.
- 브라우저 실제 확인 폭은 1280px이다. 375px 설정 요청에도 측정값이 유지되어 이번 결과를 375px 검수 성공으로 기록하지 않는다. 실기기/좁은 폭의 최종 UI 검수는 합쳐진 앱에서 진행한다.

## 운영 웹 확인

`https://newave-flow.vercel.app/login`의 기존 브라우저 세션에서 ‘새 버전으로 다시 열기’ → ‘저장 확인, 다시 열기’를 사용했다. 빈 로그인 화면에서 실행했으며 사이트 저장소 전체를 지우지 않았다.

가상 심사 계정으로 접속한 운영 웹의 내 정보 버전 **0419c26**이 당시 원격 main과 일치했다. 공개 설정 응답 후 카카오 버튼도 표시됐다. 이전 화면이 보였던 현상은 업데이트 대기 및 비동기 설정 표시와 관련돼 있었으며, 최신 배포 실패로 판단하지 않는다. 이번 브랜치의 보안 수정이 운영에 반영됐다는 의미는 아니다.

## Android 산출물과 실기기 한계

이 PC 검수본의 `versionName=1.0.0`, `versionCode=2`는 기존 값을 유지했다. 다른 PC가 준비 중인 3을 소비하거나 Play 초안을 바꾸지 않았다. 이 파일을 그대로 Play에 올리지 않는다.

| 파일 | SHA-256 |
|---|---|
| `frontend/android/app/build/outputs/bundle/release/app-release.aab` | `11FD7F25EA8CE865F1808EE8FA634E0561687C6F6D1468DBD720BF0361DA3782` |
| `frontend/android/app/build/outputs/apk/debug/app-debug.apk` | `2EC56CEC778E7853A0A4F8E165B48D68518B213E93A36323F7AE22262923C945` |

사용자는 현재 휴대폰 USB 연결이 어렵다고 답했다. 기존 SDK의 API 35 이미지로 별도 검수용 가상 기기를 만들었으나 ADB offline 상태에서 기동이 끝나지 않았다. 이번 작업에서 시작한 emulator 프로세스만 종료했으며 기존 개인 가상 기기는 변경하지 않았다. 가상 기기 실행 성공 또는 실기기 설치 성공으로 기록하지 않는다.

최종 통합·서명 앱으로 다음을 남겨 둔다.

- [ ] Play 배포 경로의 기존 앱 → 새 버전 업데이트 설치 및 로그인 유지. USB 디버그 APK와 Play 배포 서명 차이를 고려한다. 기존 앱 삭제/데이터 초기화를 자동으로 하지 않는다.
- [ ] Android 12 이상 기기를 포함한 홈/TTS/출석/행사/관리 화면, 키보드 가림, 작은 화면 레이아웃, 시스템 뒤로가기·팝업 닫기.
- [ ] 비행기 모드에서 조회/저장 안내, 재연결 후 중복 저장이나 값 소실 없는지 확인. 쓰기 검수는 가상 계정으로 한다.
- [ ] 시스템 사진 선택기의 열기·취소·가상 이미지 첨부 및 복귀.
- [ ] 로그아웃 후 앱 완전 종료/재시작과 암호화 저장소 정리, 계정 교체 시 이전 자료 미표시. 웹의 경로 차단 검수로 대체하지 않는다.
- [ ] 최종 개인정보 문서 링크·뒤로가기, 필요 시 카카오 외부 인증 복귀, 세션 갱신.

## 다른 PC와 합치는 순서

다른 PC의 노션 기록에는 개인정보 공통 문서/공개 HTML 생성, 화면 링크, native 검토 빌드, 후보 versionCode 3 준비가 올라와 있다. 아직 그쪽 의존성 파일의 실제 diff는 확인하지 못했다.

1. 해당 PC의 미커밋 개인정보 작업을 먼저 보존한다. 깨끗한 작업 상태에서 이 원격 브랜치를 fetch하고 작업 브랜치에 병합한다. `reset --hard`, 전체 파일 덮어쓰기, `npm audit fix --force`를 사용하지 않는다.
2. `package.json`이 충돌하면 그쪽 개인정보 빌드 스크립트·새 의존성을 보존하면서 `react-router-dom: "7.18.4"`를 유지한다. 잠금 파일은 합쳐진 package.json과 일치하도록 재생성/검증하며, 어느 한쪽 전체 파일을 무조건 선택하지 않는다.
3. Node 24에서 `npm ci`, `npm test`, `npm audit --omit=dev`, 웹 빌드를 실행한다. 개인정보 문서의 미확정 공개 차단을 우회한 검토 빌드를 출시본으로 사용하지 않는다.
4. 개인정보 확정본과 이번 보안 수정을 포함한 최종 커밋을 기준으로 웹 배포·버전 확인, native sync·번들·lint를 진행한다.
5. Play의 현재 최대 versionCode를 다시 확인하고, 기존 업로드 키로 서명한다. 현재 기록상 다음 후보는 3이다. 새 키 생성/교체는 하지 않는다.
6. 최종 서명·해시·인증서·실기기 시나리오를 확인한 뒤 다른 PC에서 진행하던 Play 설정·심사 계정·테스터 준비를 이어간다.

이번 브랜치를 통합한 뒤에는 최종 AAB를 다시 만들어야 한다. 앞서 만든 다른 PC의 AAB에는 이 보안 수정이 자동으로 들어가지 않는다.

## 근거 파일

현재 PC의 `frontend/.verification/release-verification-20261013/` 아래:

- `npm-runtime-audit.json`, `npm-full-audit.json`
- `production-build-0419c26.jpg`
- `router7-admin-desktop.jpg`, `router7-calendar-loaded.jpg`
- `emulator-stdout.log`, `emulator-stderr.log` (검수 환경 진단용, Git/노션 첨부 대상 아님)

Android lint XML/HTML은 `frontend/android/app/build/reports/`에 있다. 계정 암호·개인 키·토큰은 기록하거나 첨부하지 않는다. 기존 미추적 디자인 자료도 이번 커밋에 포함하지 않는다.
