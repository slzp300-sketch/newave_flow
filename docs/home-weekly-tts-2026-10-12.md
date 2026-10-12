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

## 자료

- 구현: `frontend/src/components/tts/HomeTtsSummary.jsx`, `frontend/src/pages/TTSPage.jsx`, `frontend/src/components/tts/TtsStats.jsx`
- 스토어 자료: `docs/android-store/README.md`
- APK: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- Android 진행: `docs/android-release.md`

참고 사이트: [찬양팀 영성체크](https://script.google.com/macros/s/AKfycbw_fOxdhvIRjW_w4PDwYAkmbrLYGTTrTI6Zg0IzdlzIstwZLkfmBZ2x5cov3RLV5zkV/exec). 공개된 현황 구조만 읽었으며 타인의 이름을 선택하거나 체크하지 않았다.
