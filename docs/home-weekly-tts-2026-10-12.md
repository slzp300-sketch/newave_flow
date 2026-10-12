# 홈 주간 영성 통계 개선

## 변경

찬양팀 영성체크 참고 화면의 요약·상세 구조를 참고했다. 홈에서 오늘 말씀·기도 체크를 유지하고, 같은 기록으로 주간 점수/전체 배점, 달성률, 항목별 실천 일수, 월~토 요일 체크, 예배·모임 완료를 표시한다. 뉴웨이브의 기존 배점과 월~토 기준을 사용하며 참고 서비스의 월~금 규칙을 복사하지 않는다.

미래 날짜는 점선·예정 상태로 표현한다. 주간 전체 배점 대비 달성률이므로 월요일 25%가 지난 날짜 기준 달성률이라는 의미는 아니다. ‘주간 전체 배점 기준’ 설명을 표시했다.

‘이번 주 기록 수정’은 기존 상세 체크를 펼친다. ‘내 상세 통계’는 `/tts?tab=stats&view=mine`으로 개인 추이를 바로 연다. 일반 `/tts` 진입은 기존 내 체크 화면이다. 예전 시트 합계만 있는 주차에는 일별 기록을 추정해 추가하지 않는다.

## 확인 결과

- 프런트 자동 검사 65개 통과. 체크 직렬 저장, 실패 복구, 통계 누락값/0점 구분 등 기존 검사 포함.
- 웹 빌드, native 화면 빌드 및 Capacitor 동기화 통과.
- Android `assembleDebug bundleRelease lintDebug` 통과(323개 작업, 재빌드 1분 50초). APK와 미서명 AAB 갱신. lint 경고가 모두 해소된 것은 아니다.
- 375px 홈 가로 넘침 없음. 가상 기록: 기도 체크 전 15/80점·19%·0일 → 체크 후 20/80점·25%·1일. 저장 실패 시 15/80점·19%·0일로 복구하고 오류 표시.
- 상세 수정 펼침·미래 날짜 비활성화·내 추이 바로 가기 확인. 주요 화면 콘솔 오류 없음.
- 가상 반 출석 4명 중 1명 불참으로 수정 후 공동 보고 제출 성공. 3명 출석/1명 불참 완료 화면 확인.
- 가상 행사 참석 제출 성공. 접수 종료 시 조회만 제공하고 체크/제출 컨트롤이 사라지는 것 확인.
- IAB 자동 입력으로 부분참석 날짜의 DOM 값은 바뀌었지만 React 제출 상태에 반영되지 않아 부분참석 날짜 제출 검수는 완료로 계산하지 않았다. 일반 참석 제출은 통과했으며 부분참석은 실제 기기에서 재확인한다.
- 일정 날짜 선택과 내용 표시 확인. 스토어 초안은 가상 계정·학생만 있는 실제 React 화면 4장으로 캡처했다. 운영 데이터 저장·수정은 하지 않았다.

## USB 실기기

사용자가 USB 연결을 허용하고 기기를 연결했다. 최초 `SM-N960N`과 Android 10을 확인했다. 이후 설치 시도에서 ADB 기기가 사라졌으며 Windows에는 Galaxy Note9 파일 전송 장치가 보이나 `SAMSUNG_Android` 드라이버 오류 28(미설치)이 확인됐다. 공식 Samsung USB Driver 페이지를 열어 사용자의 설치를 기다린다. 이 기록 시점에는 APK 설치 성공·실기기 로그인 검수를 주장하지 않는다.

## 후속 설치·배포 확인 (2026-10-12)

- USB 연결이 복구된 뒤 Galaxy Note9(SM-N960N, Android 10)에 `adb install -r`로 Newave Flow 1.0.0(1) 설치 성공. 사용자가 로그인 화면이 정상 표시됨을 확인했다. 로그인 완료·재실행 후 로그인 유지는 별도 확인 중이다.
- 기능 커밋 `5eb68fc`를 main에 푸시했고 Vercel과 Railway의 운영 배포 성공을 확인했다. 운영 로그인 API의 `https://localhost` 사전 요청 허용을 확인해 Android 앱 연결 경로를 검증했다.
- 첫 GitHub 자동 검사에서 프런트·백엔드·PostgreSQL 17/18 검사는 통과했으나 Android 작업은 `sdkmanager: command not found`로 실패했다. SDK 도구 설치 및 PATH 설정 단계를 명시적으로 추가했다. 수정 후 원격 검사 결과는 별도로 기록한다.

### 최종 확인

- 수정 커밋 `a4ebe6a`의 [자동 검사](https://github.com/slzp300-sketch/newave_flow/actions/runs/38253987144) 5개 모두 성공: 프런트, 백엔드, PostgreSQL 17/18, Android APK/AAB 생성·lint 및 결과물 보관.
- 운영 웹 홈의 새 주간 통계와 `/support`, `/account-deletion`을 실제 브라우저에서 조회했다. 이전 서비스워커 버전은 앱의 ‘새 버전으로 다시 열기’로 정상 갱신됐고 로그인은 유지됐다.
- 사용자가 휴대폰에서 로그인·홈 통계·앱 재시작 후 로그인 유지, 내 상세 통계·일정·출석·행사 조회와 뒤로가기 복귀를 모두 정상으로 확인했다. 실제 기기 UI를 도구로 직접 조작한 결과와는 구분한다.
- 스토어 제출은 아직 하지 않았다. 나머지 실기기 저장/오프라인/사진·격리 심사 환경·처리방침 확정·삭제 검증·서명 및 계정 인증 항목은 `android-store/README.md`와 `review-instructions.md`에 남겼다.

## 자료 링크

- 구현: `frontend/src/components/tts/HomeTtsSummary.jsx`, `frontend/src/pages/TTSPage.jsx`, `frontend/src/components/tts/TtsStats.jsx`
- 스토어 자료: `docs/android-store/README.md`
- APK: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- Android 진행: `docs/android-release.md`

참고 사이트: [찬양팀 영성체크](https://script.google.com/macros/s/AKfycbw_fOxdhvIRjW_w4PDwYAkmbrLYGTTrTI6Zg0IzdlzIstwZLkfmBZ2x5cov3RLV5zkV/exec). 공개된 현황 구조만 읽었으며 타인의 이름을 선택하거나 체크하지 않았다.
