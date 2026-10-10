# Newave Flow 코드 분석 보고서

분석일: 2026-10-10 · 대상: 현재 로컬 작업 트리 · 디자인 변경은 보류

> 이 문서는 **수정 전 분석 근거**입니다. 이후 구현·회귀 검사 결과와 완료 상태는 [코드 개선 진행 기록](implementation-progress.md), 운영 반영 조건은 [배포 점검표](deployment-checklist.md)를 확인하세요. 아래 코드 줄 번호와 재현 결과는 분석 당시 기준입니다.

현재는 디자인보다 **계정 보호 → 수정 권한 → 저장·집계 정확성**을 먼저 개선하는 편이 좋습니다. 화면에서 기능을 숨기는 것과 서버가 잘못된 요청을 거부하는 것이 일치하지 않는 부분이 있고, 저장된 데이터를 화면마다 다르게 계산하는 부분도 있습니다.

이 보고서는 실제 피해가 발생했다는 뜻이 아닙니다. 코드에서 확인한 문제, 가상 데이터로 재현한 동작, 운영 설정이나 업무 기준을 추가로 확인해야 하는 항목을 구분했습니다. 운영 서버·DB에 요청하거나 실제 계정을 변경하지 않았습니다.

## 1. 분석 범위와 방법

- 프런트엔드: 페이지 35개, 공통 컴포넌트 12개, API 모듈 17개, 라우팅·로그인 상태·캐시·빌드 설정을 훑고 주요 저장 흐름을 추적했습니다.
- 백엔드: 컨트롤러 22개, 서비스 15개, 저장소 27개, 엔티티 28개의 구조를 살펴보고 인증·권한·출석·보고·TTS·일정·전도조의 핵심 흐름을 집중 검토했습니다.
- 특히 요청이 화면 → API → 서비스 → 저장 모델 → 통계로 이어질 때 기준이 바뀌는 부분을 대조했습니다. 모든 화면을 브라우저로 조작한 전수 검수나 운영 DB를 연결한 통합 검증은 아닙니다.
- 실제 학생 명단 파일은 열거나 출력하지 않았습니다. 실데이터를 초기화하는 전체 서버 실행과 `RosterDataTest` 실행도 제외했습니다.
- 이번 분석에서는 앱의 기능 코드를 수정하지 않았습니다. 보고서와 독립적인 재현 검사만 추가했고, 이전 작업의 미커밋 변경은 유지했습니다.

| 영역 | 주요 확인 내용 | 판단 |
|---|---|---|
| 로그인·계정 찾기·권한 | 재설정, 토큰 발급/갱신, 역할 변경 반영 | 가장 먼저 수정 |
| 학생·반·제적 승인 | 학생 수정 API, 담당 반 검사, 승인 우회 | 가장 먼저 수정 |
| 출석·보고·관리자 통계 | 저장 기준, 제출 기준, 담임/부담임 집계 | 모델과 집계 기준 통일 필요 |
| TTS·회의·기도모임 | 주차 처리, 신·구 API, 자동 연동, 점수 산정 | 구형 API 정리 및 입력 검증 필요 |
| 일정·행사 참석 | 생성/수정 검증, 출결 상태, 달력 캐시 | 서버 검증과 조회 키 수정 필요 |
| 전도조·일정 배정 | 조 이동, 삭제된 조, 개인 소속 조회 | 이동을 한 번의 서버 작업으로 처리 |
| 알림·배포·유지보수 | 초기화 코드, 운영 설정, 조회 구조, 검사 자동화 | 운영 안전장치 및 회귀 검사 보강 |

## 2. 우선순위 요약

P1은 다음 기능·디자인 작업보다 먼저 처리할 항목, P2는 이어서 수정할 기능·정확성 문제입니다. 운영 조건이 확인되지 않은 항목은 별도로 표시했습니다.

| 번호 | 우선순위 | 문제 | 확인 수준 |
|---|---|---|---|
| 01 | P1 | 개인정보 일치만으로 비밀번호를 바꾸고 새 비밀번호를 반환 | 코드 + 가상 재현 |
| 02 | P1 | 일반 교사가 제적 승인 절차를 우회할 수 있음 | 코드 + 최소 웹 환경 재현 |
| 03 | P1 | 담당 반·학생 소속을 검사하지 않고 출석 저장 | 코드 + 가상 재현 |
| 04 | P1 | 비활성화·권한 하향 후에도 예전 권한으로 토큰 갱신 | 코드 + 가상 재현 |
| 05 | P1 | 접속용 토큰과 갱신용 토큰을 구분하지 않음 | 코드 + 가상 재현 |
| 06 | P1 | 통신 오류 뒤 저장 요청을 자동 재전송 | 실제 인터셉터 + 가상 통신 재현 |
| 07 | P2 | 만료된 토큰의 403 응답을 프런트가 갱신하지 않음 | 최소 웹 환경 재현 + 코드 대조 |
| 08 | P2 | 교사별 보고서와 반별 출석이 섞여 통계 중복 | 코드 + 가상 집계 재현 |
| 09 | P2 | 구형 TTS API가 미래 주차·답변 검증을 우회 | 코드 + 가상 재현 |
| 10 | P2 | 일정·출결의 서버 입력 검증이 경로마다 다름 | 코드 확인 |
| 11 | P2 | 홈·달력이 다른 범위를 같은 캐시 이름으로 저장 | 코드 + 실제 캐시 라이브러리 재현 |
| 12 | P2 | 전도조 이동의 부분 성공·삭제된 조 소속 잔존 | 코드 확인 |
| 13 | P1 점검 | 운영에서도 초기화·고정 관리자·기본 비밀값 사용 가능 | 코드 확인, 운영 설정 미확인 |
| 14 | P2 기준 결정 | 과거 행사·점수가 현재 명단·배점에 따라 달라짐 | 코드 확인, 의도한 정책인지 확인 필요 |

## 3. 문제별 근거와 개선안

### 01. 본인 인증 없이 비밀번호 재설정 가능 — P1

**근거:** [SecurityConfig.java:42](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/config/SecurityConfig.java:42)는 인증 관련 경로를 로그인 없이 허용합니다. [AuthService.java:101](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/AuthService.java:101)는 이메일·이름·전화번호가 일치하면 즉시 비밀번호를 변경하고, 112행에서 새 임시 비밀번호를 요청자에게 반환합니다. 이메일이나 휴대폰의 실제 소유자를 확인하는 단계가 없습니다.

**영향:** 해당 개인정보를 아는 사람이 계정을 가져갈 수 있습니다. 단순 비밀번호 분실 편의 기능보다 계정 보호에 직접 영향을 줍니다.

**재현:** 가상 계정으로 세 필드를 전달한 뒤, 반환된 비밀번호가 계정에 저장된 암호와 일치하는지 확인했습니다.

**개선:** 이메일·문자로 전달한 일회용 인증 링크/코드를 확인한 뒤 변경하도록 합니다. 유효 시간·사용 횟수·요청 빈도를 제한하고, 변경 뒤 기존 로그인 세션도 무효화합니다. 인증 수단을 준비하기 전에는 관리자 확인을 거친 재설정으로 제한하는 방안이 있습니다.

### 02. 일반 학생 수정 API가 제적 승인 절차를 우회 — P1

**근거:** [StudentController.java:34](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/controller/StudentController.java:34)의 수정·제적·복적 경로에는 역할 검사가 없고, 현재 사용자도 서비스에 전달하지 않습니다. [StudentService.java:85](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/StudentService.java:85)와 [211행](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/StudentService.java:211)도 대상 학생 ID로 바로 수정합니다. 반면 [DeactivationRequestController.java:36](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/controller/DeactivationRequestController.java:36)의 정식 승인 경로는 관리자 역할로 제한되어 있습니다.

**영향:** 일반 교사가 직접 제적 API를 호출하면 승인 절차를 건너뛸 수 있습니다. 학생 정보 수정도 담당 반 범위로 제한되지 않습니다. 화면에 버튼이 없어도 서버의 허용 범위는 그대로입니다.

**재현:** 실제 보안 설정과 컨트롤러만 올린 최소 웹 환경에서 `TEACHER` 역할의 직접 제적 요청이 200을 반환하고 서비스 호출까지 도달했습니다. 서비스는 가짜 객체이므로 실제 학생은 변경되지 않았습니다.

**개선:** 직접 제적·복적은 승인 권한으로 제한하고, 일반 교사의 수정은 담당 학생인지 서버에서 검사합니다. 제적 신청·메모 작성에도 같은 소속 검사를 적용합니다. 전 교사의 명단 **조회** 허용 여부는 별도 정책이므로 수정 권한 문제와 구분해야 합니다.

### 03. 출석 저장 시 담당 반과 학생 소속을 확인하지 않음 — P1

**근거:** [AttendanceService.java:36](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/AttendanceService.java:36)는 요청한 반과 로그인 사용자를 찾지만 둘의 담당 관계를 확인하지 않습니다. 67~74행에서는 학생의 실제 반과 무관하게 요청한 반으로 출석을 생성합니다. [ReportService.java:27](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/ReportService.java:27)의 보고서 저장도 담당 반 검사가 없습니다.

**영향:** 다른 반 출석 수정 또는 학생 소속과 출석 기록의 반이 다른 데이터가 만들어질 수 있습니다. 이후 반별 집계와 학생 이력이 서로 맞지 않게 됩니다.

**재현:** B반 학생을 A반 출석으로 전달했을 때 저장 객체가 A반으로 만들어지고, 교사 반 배정 저장소는 한 번도 조회되지 않았습니다.

**개선:** 저장 전에 교사의 해당 반 담당 여부, 학생의 해당 반 소속, 활성 상태를 함께 확인합니다. 관리자 예외는 명시적으로 처리합니다. 이미 담당 반 검사가 있는 [EventService.java:175](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/EventService.java:175)의 행사 출석 흐름을 참고해 공통 규칙으로 묶을 수 있습니다. 과거 반 이동 기록을 수정할 때의 소속 기준도 함께 정해야 합니다.

### 04. 권한 하향·계정 비활성화가 기존 로그인에 반영되지 않음 — P1

**근거:** [JwtAuthenticationFilter.java:30](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/security/JwtAuthenticationFilter.java:30)는 DB 상태를 확인하지 않고 토큰에 담긴 역할을 신뢰합니다. [AuthService.java:48](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/AuthService.java:48)는 갱신 시 사용자를 조회하면서도 현재 역할·활성 상태를 사용하지 않고, 예전 토큰의 역할로 새 토큰을 발급합니다. [139행](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/AuthService.java:139)의 비밀번호 변경에도 기존 토큰을 폐기하는 처리가 없습니다.

**영향:** 관리자를 일반 교사로 바꾸거나 계정을 비활성화해도 기존 토큰은 계속 작동할 수 있습니다. 만료 전에 갱신하면 예전 관리자 권한이 다시 연장됩니다.

**재현:** DB의 가상 계정을 비활성 일반 교사로 설정하고, 예전 관리자 토큰으로 갱신했을 때 새 접속 토큰에 `ADMIN`이 유지되었습니다.

**개선:** 갱신 때 최신 활성 상태·역할을 사용하고, 권한 변경·비밀번호 변경·비활성화 시 세션 버전을 올리거나 갱신 토큰을 폐기합니다. 즉시 차단이 필요한 API는 서버의 현재 상태와도 대조해야 합니다.

### 05. 접속용·갱신용 토큰을 서로 바꿔 써도 허용 — P1

**근거:** [JwtTokenProvider.java:32](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/security/JwtTokenProvider.java:32)의 두 토큰은 만료 시간만 다르고 용도 구분이 없습니다. API 인증 필터와 갱신 서비스 모두 같은 `validateToken`을 사용합니다.

**영향:** 7일짜리 갱신 토큰으로 일반 API를 호출할 수 있고, 1시간짜리 접속 토큰으로 새 갱신 토큰을 받을 수 있습니다. 짧은 접속 만료 시간을 둔 효과가 줄어듭니다.

**재현:** 두 방향 모두 가상 토큰으로 확인했습니다. 갱신 토큰을 API 인증에 사용했을 때 DB 조회도 발생하지 않았습니다.

**개선:** 토큰에 용도를 넣고 API는 접속용만, 갱신 API는 갱신용만 허용합니다. 갱신 토큰의 교체·폐기·재사용 감지도 04번과 함께 설계합니다.

### 06. 네트워크 오류 후 쓰기 요청까지 자동 재실행 — P1

**근거:** [client.js:57](C:/Users/user/newave_flow/frontend/src/api/client.js:57)는 응답이 없으면 HTTP 메서드 구분 없이 3초 뒤 한 번 더 요청합니다. [EventService.java:57](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/EventService.java:57)의 일정 생성과 [StudentService.java:192](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/StudentService.java:192)의 일괄 진급은 반복 실행 시 결과가 달라집니다.

**영향:** 서버는 저장했지만 응답만 끊긴 경우 일정이 두 번 생성될 수 있습니다. 진급 매핑에 연속 학년이 포함되어 있으면 같은 학생이 두 단계 올라갈 수도 있습니다.

**재현:** 실제 프런트 인터셉터에 가상 통신 어댑터를 연결했습니다. 첫 저장 뒤 응답만 실패하도록 만들자 같은 POST가 다시 실행되어 쓰기 횟수가 2가 되었습니다. 운영 요청은 보내지 않았습니다.

**개선:** 자동 재시도는 우선 조회 요청으로 제한합니다. 진급·일정 생성 등 중요한 쓰기에는 작업 번호를 부여하고, 같은 번호의 재요청은 한 번만 반영합니다. 응답이 불확실할 때는 재등록보다 처리 결과 확인 흐름을 제공합니다.

### 07. 만료된 토큰이 403으로 처리되어 자동 갱신이 작동하지 않음 — P2

**근거:** [SecurityConfig.java:35](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/config/SecurityConfig.java:35)에 미인증 응답을 401로 지정하는 설정이 없습니다. 만료 토큰은 필터에서 인증되지 않은 채 통과하고, 최소 웹 환경에서 실제 응답은 403이었습니다. [client.js:64](C:/Users/user/newave_flow/frontend/src/api/client.js:64)는 401일 때만 갱신합니다. [router/index.jsx:93](C:/Users/user/newave_flow/frontend/src/router/index.jsx:93)의 사전 갱신 여부도 상태의 초기값으로만 반영되어, 계속 열린 앱에서 시간이 지난 경우를 보장하지 않습니다.

**영향:** 앱을 오래 켜두면 로그인 화면은 유지되는데 조회·저장만 실패할 수 있습니다. 새로고침 후에는 초기 갱신을 거치므로 증상이 사라지는 형태도 가능합니다.

**개선:** 미인증·만료는 401, 인증된 사용자의 권한 부족은 403으로 구분합니다. 라우터와 API 클라이언트의 갱신 처리를 하나로 합치고, 동시 요청의 갱신 성공·실패를 모두 종료 처리합니다. 현재 [client.js:94](C:/Users/user/newave_flow/frontend/src/api/client.js:94)는 갱신 실패 시 대기 콜백을 비우기만 해 대기 요청의 Promise를 거절하지 않습니다.

### 08. 교사별 보고서를 반별 출석으로 합산해 중복 집계 — P2

**근거:** [Attendance.java:14](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/entity/Attendance.java:14)는 학생+날짜를 고유 기준으로 사용하지만, [DailyReport.java:15](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/entity/DailyReport.java:15)는 교사+반+날짜를 사용합니다. [AttendanceService.java:105](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/AttendanceService.java:105)는 저장한 교사마다 보고서를 만들고, [143행](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/AttendanceService.java:143)의 반별 요약은 이를 중복 제거 없이 반환합니다. [AdminStudentAttendancePage.jsx:322](C:/Users/user/newave_flow/frontend/src/pages/AdminStudentAttendancePage.jsx:322)는 반환된 행을 전부 합산합니다.

**영향·재현:** 학생 4명·출석 3명인 같은 반에 교사 두 명의 보고서가 있으면, 가상 집계에서 반이 두 줄로 나오고 전체 학생 수는 8명으로 계산됩니다. 한 교사가 다시 수정해도 다른 교사 보고서의 과거 집계는 남습니다.

추가로 [ReportService.java:101](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/ReportService.java:101)는 같은 반의 여러 보고서 중 첫 번째를 반환하고, [WeeklyStatusController.java:35](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/controller/WeeklyStatusController.java:35)는 본인 보고서만 확인합니다. 출석 화면의 완료 표시와 홈의 완료 표시가 달라질 수 있습니다.

**개선:** 반의 공동 출석 보고라면 반+날짜당 하나로 통합하고 최종 수정자를 별도로 기록하는 방향을 권합니다. 교사별 보고가 필요한 경우에는 개인 제출 상태와 반별 출석 수를 분리합니다. 저장된 인원수의 중복 합산 대신 동일한 원본 출석으로 집계하고, 기존 중복 데이터의 통합 기준도 정해야 합니다.

### 09. 구형 TTS 제출 API로 새 검증을 우회 — P2

**근거:** [TtsController.java:40](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/controller/TtsController.java:40)의 구형 제출 경로가 남아 있습니다. [TtsService.java:200](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/TtsService.java:200)는 연도·주차·답변을 그대로 처리하며, 새로운 개별 저장 경로의 미래 주차·활성 항목·답변 형식 검증을 공유하지 않습니다. [550행](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/TtsService.java:550)은 요일 이름이 아니라 답변 객체의 모든 참 값을 점수로 셉니다.

**영향:** 화면을 통한 정상 입력과 별개로, 미래 주차나 잘못된 요일 키가 저장·점수화될 수 있습니다. 구형 경로에는 토~화 제출 제한도 남아 있어 현재의 마감 없는 정책과 다릅니다.

**재현:** 구형 제출 가능 요일 조건만 가짜로 열고, 2099년 주차와 요일이 아닌 키를 전달했습니다. 미래 기록이 만들어지고 해당 값이 점수에 포함됐습니다.

**개선:** 사용하지 않는 구형 경로를 제거하거나 새 저장 검증으로 연결합니다. 허용 주차·항목·요일·답변 개수·중복 항목을 서버에서 검사하고, 점수는 검증된 답변만으로 계산합니다.

### 10. 입력 검증이 화면과 API 경로마다 다름 — P2

**근거:** [EventController.java:111](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/controller/EventController.java:111)는 교사 행사 출석 요청에 `@Valid`를 적용하지 않습니다. [EventDto.java:103](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/dto/event/EventDto.java:103)는 학생 출석 목록 내부의 항목 검증이 빠져 있습니다. 출석 상태도 제한된 타입이 아닌 문자열로 저장하는 경로가 있습니다. [EventService.java:83](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/EventService.java:83)는 생성 시 종료일을 검사하지만, [102행](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/EventService.java:102)의 수정에는 같은 검사가 없습니다.

**영향:** 허용되지 않은 출결 값이나 시작일보다 빠른 종료일이 들어갈 수 있습니다. 일반 출석의 [AttendanceService.java:62](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/AttendanceService.java:62)는 잘못된 문자열에서 예외가 나므로 사용자 입력 오류가 서버 오류로 표현될 수 있습니다.

**개선:** 상태는 허용된 값으로 제한하고, 중첩 요청에도 검증을 적용합니다. 생성·수정의 날짜 규칙을 공유하고 잘못된 요청은 400으로 설명합니다. 불참 사유·부분 참석 시작일 등 화면의 필수 조건도 서버에서 동일하게 확인합니다.

### 11. 홈과 달력이 다른 범위를 동일한 캐시에 저장 — P2

**근거:** [Home.jsx:337](C:/Users/user/newave_flow/frontend/src/pages/Home.jsx:337)는 월 첫날~마지막 날을, [CalendarPage.jsx:86](C:/Users/user/newave_flow/frontend/src/pages/CalendarPage.jsx:86)는 달력에 함께 보이는 전월·다음 달 날짜까지 조회합니다. 둘 다 `['events', 'yyyy-MM']` 키를 사용하며 [queryClient.js:5](C:/Users/user/newave_flow/frontend/src/queryClient.js:5)의 기본 캐시 유효 시간은 5분입니다.

**영향:** 홈에서 달력으로 이동하면 달력 가장자리의 전월·다음 달 일정이 누락될 수 있습니다. 화면을 방문한 순서에 따라 같은 달의 데이터가 달라집니다.

**재현:** 실제 React Query의 `QueryClient`에서 같은 키로 좁은 범위를 먼저 저장하면, 넓은 범위의 조회 함수가 실행되지 않고 기존 결과를 재사용하는 것을 확인했습니다. 화면 이동을 직접 자동 조작한 검사는 아닙니다.

**개선:** 조회 키에 실제 `from`, `to` 값을 포함합니다. 학생·반·전도 일정 수정 후에도 관련 화면을 함께 갱신할 수 있도록 조회 키와 무효화 규칙을 공통 모듈로 모읍니다.

### 12. 전도조 이동이 중간에 끊기면 두 조에 남을 수 있음 — P2

**근거:** [EvangelismAdminPage.jsx:117](C:/Users/user/newave_flow/frontend/src/pages/EvangelismAdminPage.jsx:117)는 새 조에 추가한 뒤 기존 조에서 제거하는 두 요청을 순서대로 보냅니다. [EvangelismService.java:55](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/EvangelismService.java:55)는 각 조 변경만 별도로 처리합니다. [EvangelismGroupMember.java:8](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/entity/EvangelismGroupMember.java:8)의 고유 제약도 조+교사여서 한 교사의 복수 조 소속을 허용합니다.

**영향:** 첫 요청 성공·두 번째 실패 시 두 조에 동시에 남습니다. 실패를 잡아 화면을 동기화하는 처리도 없어 이동 결과가 불명확해집니다. 또한 [EvangelismService.java:48](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/EvangelismService.java:48)는 조만 비활성화하고 소속은 남기며, [87행](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/EvangelismService.java:87)의 개인 조회는 활성 여부 없이 첫 소속을 선택합니다. 삭제된 조가 내 조로 표시될 수 있습니다.

**개선:** 교사 이동 전용 API 하나에서 추가·제거를 함께 확정하거나 함께 취소합니다. 한 명당 하나의 활성 조라는 규칙을 서버에서도 보장하고, 조 삭제 시 소속 종료 및 개인 조회 기준을 함께 처리합니다.

### 13. 운영에서도 개발용 초기화와 기본 비밀값이 적용될 여지 — P1 점검

**근거:** [DataInitService.java:16](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/config/DataInitService.java:16)은 `prod`에서도 실행됩니다. [47행](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/config/DataInitService.java:47)은 고정 이메일 계정을 매 시작 시 ADMIN으로 되돌리고, 56행 이후 사용자 수가 0이면 여러 테이블을 비우고 초기 데이터를 만듭니다. 121행에는 초기 관리자 비밀번호가 코드에 있습니다. [application.yml:74](C:/Users/user/newave_flow/backend/src/main/resources/application.yml:74)는 JWT 비밀값의 고정 대체값을 허용하고, [68행](C:/Users/user/newave_flow/backend/src/main/resources/application.yml:68)은 기본 프로필이 `dev`입니다. 실제 비밀값은 이 보고서에 복사하지 않았습니다.

**영향:** 고정 계정의 권한을 낮춰도 재시작으로 되돌아갈 수 있습니다. 운영 환경변수 누락 시 알려진 서명값이나 메모리 DB가 사용될 위험도 있습니다. 테이블 초기화는 사용자 수가 0인 조건에서만 실행되므로 일반적인 매 재시작마다 데이터가 지워진다는 뜻은 아닙니다.

**확인 한계:** Railway의 실제 환경변수, 현재 관리자 비밀번호, 백업·복원 상태는 확인하지 않았습니다. 운영에서 기본값을 실제 사용 중이라고 단정하지 않습니다.

**개선:** 운영에서 일반 시딩·삭제 초기화를 분리하고, 관리자 최초 생성은 명시적인 일회 작업으로 처리합니다. 운영 프로필·DB 연결·JWT 비밀값이 없으면 시작을 실패시키고, 권한 변경은 시작 코드가 아닌 정상 관리 기능에서만 수행합니다. DB 변경에는 버전이 있는 마이그레이션을 도입합니다.

### 14. 과거 행사와 점수가 현재 데이터에 따라 바뀜 — P2, 업무 기준 결정 필요

**근거:** [EventService.java:321](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/EventService.java:321)의 과거 행사 요약은 행사 당시 명단 대신 현재 활성 학생·현재 반으로 만듭니다. [TtsService.java:476](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/TtsService.java:476)는 질문 배점을 갱신하고, [545행](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/TtsService.java:545)은 과거 답변도 질문의 현재 배점으로 다시 계산합니다.

**영향:** 학생을 제적하거나 반을 바꾸면 과거 행사 요약에서 빠지거나 다른 반으로 옮겨집니다. TTS 배점을 변경하면 과거 주차 점수·순위도 바뀔 수 있습니다.

**개선:** 행사 당시 인원·반과 당시 점수를 보존하려는 목적이라면 소속 이력·배점 버전 또는 확정 시점의 값을 저장합니다. 모든 과거 기록을 새 기준으로 재계산하려는 의도라면 그 정책을 관리자 화면에서 설명해야 합니다. 이 항목은 업무 기준을 정한 뒤 수정해야 합니다.

## 4. 구조·유지보수 개선

| 항목 | 현재 근거 | 권장 방향 |
|---|---|---|
| 자동 검사 부족 | [package.json:6](C:/Users/user/newave_flow/frontend/package.json:6)에 검사 실행 명령이 없고, 백엔드의 기존 테스트는 주차 검사 2개와 출력 중심의 [RosterDataTest.java:17](C:/Users/user/newave_flow/backend/src/test/java/com/newaveflow/RosterDataTest.java:17)가 중심입니다. 저장소에 `.github` 검사 설정은 없습니다. | 인증·권한·출석 집계·실패한 저장부터 회귀 검사에 포함하고 배포 전 자동 실행합니다. 외부 서비스의 검사 설정은 이번에 확인하지 않았습니다. |
| 조회 횟수 증가 | [AttendanceService.java:148](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/service/AttendanceService.java:148)은 보고서마다 담임을 조회하고, [MeetingMinuteController.java:44](C:/Users/user/newave_flow/backend/src/main/java/com/newaveflow/controller/MeetingMinuteController.java:44)는 회의록마다 출석을 조회합니다. | 묶음 조회로 바꾸되 먼저 응답 시간·SQL 횟수를 측정합니다. 현재 서비스가 느리다는 실측 결과는 아닙니다. |
| 초기 화면 로딩 | [router/index.jsx:10](C:/Users/user/newave_flow/frontend/src/router/index.jsx:10)부터 관리자 화면까지 정적으로 가져옵니다. | 자주 쓰는 교사 화면과 관리자·통계 화면을 필요할 때 나눠 로드합니다. |
| 업무 규칙 중복 | 출석 수·제출 상태가 AttendanceService, ReportService, WeeklyStatusController와 화면에 분산되어 있습니다. | 계산 원본과 제출 기준을 하나로 정하고 같은 결과를 재사용합니다. |
| 운영 DB 변경 관리 | [application.yml:45](C:/Users/user/newave_flow/backend/src/main/resources/application.yml:45)의 `ddl-auto: update`에 의존합니다. | 변경 이력·사전 백업·복원 방법이 있는 마이그레이션으로 전환합니다. 실제 백업 운영 여부는 별도 확인이 필요합니다. |
| 낡은 규칙 잔존 | 구형 TTS 제출 제한, 쓰이지 않는 출석 제출 기간 계산, 기존 마감 안내 등이 새 정책과 함께 남아 있습니다. | 사용 경로를 확인한 뒤 제거·통합합니다. 알림은 기본 비활성 설정이므로 잘못된 안내가 현재 발송 중이라고 단정하지 않습니다. |

유지할 만한 기반도 있습니다. BCrypt 비밀번호 저장, 다수 관리자 API의 역할 제한, 일반 출석의 미래 날짜 차단, 행사 출석의 담당 반 검사, TTS의 저장 순서 제어와 실패 복구, 일정 일괄 등록의 트랜잭션 처리는 이미 있습니다. 전면 재작성보다 이러한 기준을 빠진 경로까지 확장하는 편이 적절합니다.

## 5. 실행한 검증과 한계

| 검증 | 결과 | 범위 |
|---|---|---|
| 추가 백엔드 재현 검사 | 8개 통과 | 가상 계정·학생·저장소, 실제 인증 설정의 최소 웹 환경 |
| 기존 백엔드 주차 검사 | 2개 통과 | TtsWeekTest, 백엔드 컴파일 포함 |
| 프런트 재현 검사 | 2개 확인 | 실제 Axios 인터셉터 + 가상 어댑터, 실제 QueryClient |
| 기존 행사 마감 검사 | 4개 통과 | 프런트 날짜·마감 유틸리티 |

**추가 재현 검사의 통과는 안전하다는 뜻이 아니라, 보고한 잘못된 현재 동작이 재현됐다는 뜻입니다.** 수정 후에는 이 검사들이 실패하거나 올바른 동작을 기대하도록 바뀌어야 합니다. 앱의 기본 테스트 실행 목록에는 연결하지 않았습니다.

검사 파일과 실행 방법: [code-audit-checks/README.md](C:/Users/user/newave_flow/docs/code-audit-checks/README.md). 운영 DB 제약·실제 동시 접속·브라우저 전체 동선·배포 환경변수·개인정보 보관 정책은 검증 범위 밖입니다. 이번에는 UI 코드를 바꾸지 않아 프런트 전체 빌드를 다시 실행하지 않았습니다.

## 6. 권장 작업 순서와 완료 기준

1. **계정·권한 차단:** 01~05와 13을 먼저 처리합니다. 본인 인증 없는 비밀번호 변경, 다른 반 수정, 비활성 계정 갱신, 잘못된 종류의 토큰 사용이 모두 거절되어야 합니다. 운영 설정은 값의 유출 없이 별도로 확인합니다.
2. **저장·로그인 안정화:** 06~07과 10, 12를 처리합니다. 응답이 끊겨도 중복 저장·이중 진급이 없어야 하고, 만료된 로그인은 정상 갱신되며 조 이동은 전체 성공 또는 전체 취소되어야 합니다.
3. **통계 기준 통일:** 08~09와 14를 처리합니다. 같은 반을 두 교사가 관리해도 인원은 한 번만 집계되고, 개인 제출 상태와 반 완료 상태가 명확해야 합니다. 과거 기록 보존 기준과 기존 데이터 정리 계획을 함께 확정합니다.
4. **화면 데이터·운영 개선:** 11, 캐시 갱신, 자동 검사, 조회 성능과 배포 절차를 정리합니다. 방문 순서에 관계없이 같은 일정·명단이 보여야 합니다.
5. **디자인 재개:** 실제 브랜드 자료를 바탕으로 대표 화면을 만든 뒤 확대합니다. 출석의 저장·완료·오류 상태와 관리자 권한이 먼저 정리되어야 화면을 다시 고치는 일을 줄일 수 있습니다.

담임·부담임의 공동 제출 기준, 한 교사의 복수 반·복수 전도조 허용 여부, 과거 명단·점수 보존 기준, 임원교사의 관리 범위는 구현 전에 결정할 업무 항목입니다. 그 결정과 관계없이 계정 재설정·토큰·담당 범위 검증·중복 쓰기 방지는 먼저 개선할 수 있습니다.
