# App Store 5.6 반려 대응 — 2026-10-24

상태: 코드·로컬 검수 완료. 2026-10-24 19:02 KST 기존 심사 메시지에 아래 회신을 발송했고 메시지가 1개에서 2개로 증가하며 발송 본문이 표시되는 것을 확인했다. 운영 반영, 새 빌드 업로드, 재제출은 아직 하지 않았다.

## 확인된 반려와 판단 범위

- 앱 6823391707, iOS 1.0.0(3), 제출 70f54bcc-76bb-4365-8864-f01e3edfc7ba.
- 제출 빌드 기준 커밋: `57f635095f644ae36a778429d4d94b93844216d2`.
- Apple 메시지: 2026-10-24 01:09 KST, Guideline 5.6 — Developer Code of Conduct. 심사 중 의도적으로 숨긴 것으로 보이는 기능과 비정상 행동 패턴을 지적했다.
- 기능명, 문제 화면, 재현 단계, 기기·OS 정보는 제공되지 않았다. 아래 항목은 코드에서 확인한 개선 대상이며 Apple의 확정 원인으로 단정하지 않는다. 수정만으로 승인된다고 보장할 수 없다.
- 기존 심사 메모에도 가상 서버, 교사·관리자 계정, 외부 인증 차이, 신규 가입 승인 필요성을 이미 적었다. 가상 환경을 전혀 고지하지 않았다고 설명하거나 실제 기만 행위가 있었다고 추정해 인정하지 않는다.
- [반려 상세](https://appstoreconnect.apple.com/apps/6823391707/distribution/reviewsubmissions/details/70f54bcc-76bb-4365-8864-f01e3edfc7ba)
- [공식 지침](https://developer.apple.com/app-store/review/guidelines/): 2.1의 심사 접근성, 2.3.1의 기능 공개, 5.6의 신뢰성 기준을 함께 확인했다. 계정 없이 사용하는 내장 데모로 바꾸지 않았으며, 지정된 계정 인증과 역할별 접근 제어를 유지한다.

## 이번 수정

| 확인한 동작 | 수정 내용 |
| --- | --- |
| 이메일 종류에 따라 로그인 API가 자동 선택됨 | 로그인 전에 일반/가상 자료 계정을 직접 선택하고 차이를 설명. 이메일과 선택이 다르면 요청 전 차단. 잘못된 서버로 비밀번호를 전송하지 않음 |
| 외부 인증 설정이 꺼져 있거나 조회 실패 시 버튼·연결 메뉴가 사라질 수 있음 | iOS Apple 및 카카오 항목을 표시하고 가상 계정 제한, 로딩, 이용 불가, 조회 실패·재시도를 구분 |
| 기능·역할 차이 설명이 여러 곳에 분산됨 | 로그인 전에도 `/app-guide`에서 전체 기능, 교사/관리자 역할, 개인정보 분리와 외부 인증·가입 승인 차이 확인 |
| 가상 서버가 시작/매일 초기화 때 계정 권한·상태, 행사 날짜 등을 다시 쓸 수 있음 | 비어 있는 새 가상 DB만 최초 구성. 기존 DB는 자동 재설정하지 않음. 이름·권한·일정·확인 기록 보존 |
| 전도 배정 및 불참자 회의록 등 일부 예시 경로의 자료 부족 | 새 가상 DB에 전도 조·담당 일정, 과거 회의 불참·회의록, 기도모임 불참 예시 구성 |

운영 DB·서명·OAuth 키·승인 조건·마감일 규칙은 바꾸지 않았다. 심사 날짜, IP, 특정 심사자 여부로 기능을 숨기거나 공개하는 로직은 추가하지 않았다. 계정 삭제의 이메일별 환경 분류는 기존 방식으로 유지하므로 모든 API의 분기 자체를 없앴다고 표현하지 않는다.

## 기능 접근 비교 및 재심사 동선

| 기능 | 가상 교사 | 가상 관리자 | 일반 계정과의 차이/조건 |
| --- | --- | --- | --- |
| TTS·출석·반 보고 | 담당 반/본인 기록 조회·저장 | 관리 메뉴의 통계·출석 관리 | 실제 자료 대신 가상 자료. 기존 제출 버전의 점수·마감 규칙 유지 |
| 일정·행사 | 일정 조회, 참석 선택 | 일정·행사 및 출석 관리 | 행사별 대상·날짜 조건 동일 |
| 교사회의·기도모임 | 주차별 투표 | 참석·불참 및 필사 관리 | 주차와 마감 조건 동일. 과거 회의록은 해당 주차 선택 |
| 회의록 | 조회, 불참자 확인 | 작성·수정·관리 | 불참 기록과 회의 날짜가 일치해야 확인 동선 재현 가능 |
| 전도 로테이션 | 조·담당 일정·상태 조회 | 조·일정·배정 관리 | 새 가상 DB에는 4개 일정, 2명 배정 예시 |
| 교적부·반 | 담당/허용 범위 | 교사·학생·반 관리 | 실제 학생 개인정보는 접근 불가 |
| 신고·사진·계정 삭제 | 신고·본인 삭제 요청 | 신고/사진/승인·정지 관리 | 개인정보·접근 제어 유지. 삭제 검수용 별도 계정 사용 |
| Apple·카카오 로그인/연결 | 가상 계정에는 연결 안 함. 사유 표시 | 동일 | 일반 계정과 실제 외부 인증으로 별도 검수 필요 |
| 신규 가입 | 제공된 계정으로 업무 기능 검수 | 승인 업무 확인 | 일반 가입자는 관리자 승인 필요. 심사 계정 우회 승인 로직을 추가하지 않음 |

앱에서 `로그인 → 전체 기능·계정별 이용 안내` 확인 후, `가상 자료 계정` 선택 → 제공된 교사 계정으로 로그인 → `전체`에서 기능 탐색. 관리자 기능은 로그아웃 후 제공된 관리자 계정 → `전체 → 관리`에서 확인한다. 비밀번호·계정 주소는 이 문서나 작업로그에 적지 않고 App Store Connect의 보안 입력란에서만 관리한다.

## 로컬 검증 결과

- 프런트 자동 검사 110개 통과: 명시적인 환경 선택, 잘못된 선택의 네트워크 차단, 기존 토큰을 로그인 요청에 싣지 않는 동작 포함.
- 서버 전체 검사 170개 중 158개 통과, 12개 PostgreSQL 전용 검사 건너뜀. 실패 0. PostgreSQL 마이그레이션 검증 완료로 해석하지 않는다.
- 위 검사 중 가상 환경/격리 5개: 실제 localhost HTTP + 임시 H2 DB로 역할별 접근, 회의 참석 저장, 기도모임 투표, 회의록 확인, 전도 배정 조회, 초기화 재실행과 프로세스 재시작 후 기록·권한 보존 확인.
- 일반 웹 빌드 및 최종 네이티브 모드 정적 빌드 성공. 기존 번들 크기 경고 있음.
- `ios:verify` 성공: 네이티브 연결, Keychain 검사 타깃, 패키지, 아이콘, privacy 및 HTTPS 소스 설정.
- `bootReviewJar` 성공. 패키지만 생성했으며 서버 배포하지 않음.
- 실제 React 화면을 메모리 응답에 연결한 로컬 브라우저에서 계정 선택, 인증 이용 불가·오류, 계정 연결 안내, 전체 기능 안내 확인. 실제 Apple/카카오 인증이나 서버 연결을 수행하지 않는 미리보기다.
- Windows 소스/정적 빌드 검증이며 Xcode archive·서명·실제 iPhone/iPad 검수를 대신하지 않는다.

## 반영 전 반드시 남은 확인

1. Apple에 문제로 본 기능·경로·기기/OS를 요청하는 회신은 발송 완료했다. 답변이 오면 수정 범위를 대조한다.
2. 실제 iPhone 및 iPad에서 일반 계정의 Apple 로그인 → 신규 가입 → 승인 대기/지원 → 승인 후 접근, 기존 계정 연결, 취소·재로그인·삭제 흐름을 확인한다. 실제 Kakao 연결도 별도 확인한다. 가상 계정에서 OAuth가 막히는 차이를 숨기거나 성공한 것처럼 시뮬레이션해 제출하지 않는다.
3. 새 빌드의 일반/가상·교사/관리자 기능을 같은 소스 기준으로 검수하고 주요 화면/동선을 심사 메모에 명시한다. 모든 경로가 접근된다는 증거를 실제 빌드에서 확보한다.
4. 기존 가상 DB는 이번 수정으로 재설정되지 않는다. 새 예시는 자동 주입되지 않으므로 승인된 반영 단계에서 관리자 기능으로 필요한 조·일정·불참 기록을 준비한다. DB 삭제, 계정 복원, 심사 중 날짜의 자동 이동을 대안으로 사용하지 않는다. 기간이 지난 자료는 주차 선택으로 보고 새 자료는 관리 기능으로 등록한다.
5. 제출 후 공용 서버는 별도 업데이트 이력이 있다. **이 브랜치의 구버전 서버 전체를 운영에 덮어쓰지 않는다.** 현재 운영 코드/DB 마이그레이션을 기준으로 필요한 서버 수정만 병합하고 현재 Android·제출 iOS 호환성을 확인한다. review 프로파일 전용 변경이라도 운영 코드의 후퇴가 없어야 한다.
6. 기존 PostgreSQL 복제/로컬 DB 마이그레이션과 호환성을 확인한다. 이번 패치에는 새 스키마 변경이 없지만 기존 운영 마이그레이션 검증은 별도다.
7. 사용자 검토 후 실제 적용·새 iOS 빌드 생성·메모 갱신·재제출을 진행한다. 현재 제출 건과 운영 앱, Android 테스트는 그대로 둔다. 별도로 준비 중인 출시 후 화면/TTS/푸시 개편은 이번 최소 수정에 섞지 않는다.

## Apple 회신 — 2026-10-24 19:02 KST 발송 완료

Hello App Review Team,

Thank you for reviewing Newave Flow, app ID 6823391707, version 1.0.0 (3). We would like to understand and address the concern under Guideline 5.6. Could you identify the feature or screen that appeared intentionally hidden, together with the steps and device/OS used to observe it?

Newave Flow is an internal workflow app for approved teachers and ministry staff. Teacher and administrator roles have different permissions. The review accounts use a separate synthetic-data backend to protect real teacher and student information. This separation, both roles, and the external authentication limitation were described in the original Review Notes. Apple and Kakao authentication use the normal account flow; they are not connected to the synthetic accounts. New normal-service registrations require administrator approval.

In our investigation, we identified areas where these differences could be clearer. We have prepared local changes that make the account environment an explicit choice, keep external authentication availability and errors visible, provide a public feature/role guide, and prevent the synthetic backend from resetting edited records on restart or on a daily schedule. We have also prepared more complete synthetic assignments for review of the existing workflows. These changes have not yet been deployed or submitted.

We would appreciate your specific observations so that we can verify the affected behavior and provide a focused update with complete review instructions. We will preserve the existing submission while we clarify the concern.

Thank you.

위 내용은 발송 당시 미배포 상태를 명시한 실제 회신이다. 수행하지 않은 실기기 검증이나 모든 기능의 동일성을 단정하지 않았다. 접수 증빙은 로컬 비공개 작업폴더의 `.verification/apple-rejection-reply-20261024.png`에 보관했다.
