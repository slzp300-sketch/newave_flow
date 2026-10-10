# 코드 분석 재현 검사

> **보관용: 수정 전 문제 재현 자료입니다. 현재 코드의 검증 명령으로 사용하지 마세요.** 생성자·저장 구조가 변경되어 아래 과거 검사 코드는 현재 소스와 호환되지 않을 수 있습니다. 현재 회귀 검사는 `frontend`에서 `npm test`, `backend`에서 `./gradlew build`(Windows: `gradlew.bat build`)로 실행합니다. 실제 명단을 읽던 `RosterDataTest`도 가상 데이터 검사로 교체되었습니다. 결과는 [진행 기록](../implementation-progress.md)을 참고하세요.

2026-10-10 코드 분석의 근거를 검증하기 위한 독립 검사입니다. 앱 기능 코드는 수정하지 않았습니다.

**이 검사들은 일부 잘못된 현재 동작이 발생함을 기대합니다. 통과는 문제 재현을 뜻하며, 보안 검사 합격을 뜻하지 않습니다.** 수정 작업에서는 기대 결과를 바꾸어 회귀 검사로 옮겨야 합니다. 기본 테스트 실행이나 CI에 그대로 추가하지 마세요.

## 분석 당시 실행 방법 (현재 실행 대상 아님)

프로젝트 루트에서 프런트 의존성이 설치된 상태로 실행합니다. 가상 통신만 사용합니다.

```powershell
node docs/code-audit-checks/frontend-checks.mjs
node --test frontend/tests/eventAttendance.test.js
```

백엔드는 Java 17 이상과 기존 Gradle 의존성 캐시가 필요합니다. 아래 명령은 `backend` 폴더에서 실행합니다. 테스트 명칭을 지정하여 실제 명단을 초기화하는 `RosterDataTest`가 실행되지 않도록 했습니다.

```powershell
.\gradlew.bat test --tests com.newaveflow.audit.CodeAuditVerificationTest --tests com.newaveflow.TtsWeekTest --init-script ../docs/code-audit-checks/audit.init.gradle --no-daemon --offline
```

이 환경에서는 `JAVA_HOME`을 설치된 JDK 21 경로로 지정해 실행했습니다. 다른 환경에서는 로컬 JDK 경로를 사용합니다. 네트워크가 제한된 실행 환경에서는 Gradle 프로세스 실행을 위한 추가 승인 권한이 필요할 수 있습니다.

`audit.init.gradle`은 위 명령에만 별도의 Java 검사 폴더를 연결합니다. 앱의 `build.gradle`과 기본 검사 구성을 변경하지 않습니다. Java 검사에서는 가상 저장소, 합성 토큰, 최소 Spring MVC 설정만 사용합니다. Spring Boot 전체 실행, DB 접속, 실제 계정, 운영 HTTP 요청, 실제 명단 파일을 사용하지 않습니다.

## 이번 결과

- Java 재현 검사 8개 통과: 재설정, 비활성/권한 하향 후 토큰 갱신, 토큰 용도 혼용 2건, 반 소속 불일치 출석, 반별 중복 집계, 구형 TTS 검증 우회, 교사의 직접 제적 경로와 만료 토큰 403 응답.
- 기존 TtsWeekTest 2개 통과.
- 프런트 검사 2개 확인: 응답이 끊긴 POST의 자동 재시도, 서로 다른 일정 조회 범위의 캐시 충돌.
- 기존 행사 마감 검사 4개 통과.

일부 Java 검사는 하나의 테스트 메서드에서 연관된 조건을 함께 확인합니다. 테스트 수는 결함 수와 동일하지 않습니다. 운영 DB 제약, 실제 네트워크 장애, 브라우저 화면 조작을 모두 재현한 통합 검사는 아닙니다.
