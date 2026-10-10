# PostgreSQL 전환 회귀 검사

현재 앱으로 새 테이블을 만든 뒤 검사하는 대신, 변경 전 커밋 `7e3584eff3541b1666478a90118b559ffa1aa323`의 엔티티 소스만 추출해 실제 이전 PostgreSQL 스키마를 생성합니다. 구버전 앱·명단 초기화 코드는 실행하지 않습니다.

## 검사 순서

1. 비어 있는 별도 로컬 PostgreSQL DB를 만듭니다. 이름은 `newave_migration_`으로 시작해야 합니다. 생성기와 검사는 `localhost`/`127.0.0.1` 외의 주소를 거절합니다.
2. 아래 환경변수를 지정합니다. 접속 비밀번호는 안전한 로컬 설정 또는 CI 환경변수로 제공하고 커밋하지 않습니다.
   - `MIGRATION_TEST_JDBC_URL`: 예 `jdbc:postgresql://127.0.0.1:5432/newave_migration_ci`
   - `MIGRATION_TEST_USER`, `MIGRATION_TEST_PASSWORD`
   - `RUN_POSTGRES_MIGRATION=true`
   - `MIGRATION_SYNTHETIC_FIXTURE=true`
3. `backend`에서 실행합니다. Windows는 `gradlew.bat`를 사용합니다.

```sh
./gradlew createMigrationBaseline --init-script db/verification/legacy.init.gradle --no-daemon
./gradlew test --tests com.newaveflow.PostgresMigrationTest --no-daemon
```

원본 커밋이 로컬 Git 이력에 있어야 합니다. GitHub Actions의 전환 검사 작업은 `fetch-depth: 0`으로 이력을 가져옵니다. 검사 DB는 각 실행에 새로 준비합니다. 같은 DB 재실행이 실패했다고 원본을 임의로 삭제하지 마세요.

## 검증 내용

- 담임·부담임의 중복 보고서, 서로 다른 메모, 중복 메모, 제출/임시저장 혼합을 반별로 합칩니다.
- 변경 직후 고의 SQL 오류를 넣어 모든 DDL·데이터 변경이 롤백되는지 확인합니다.
- 모든 원본 보고서의 행 해시와 보관본이 일치하는지 확인합니다.
- 원본 출석·행사 출석·TTS 답변·배점 행이 바뀌지 않았는지 해시로 대조합니다.
- 제적 학생·비활성 교사의 실제 출석과 출석 표시를 꺼둔 과거 행사를 보존합니다.
- 같은 전환 SQL 재실행을 거절하고 기존 결과를 유지합니다.
- 새 앱을 `prod`, `ddl-auto=validate`로 실제 기동합니다. 명단·계정 초기화가 비활성임을 확인합니다.
- 전환 후 공동 출석 저장, 기존 주차 TTS 체크 수정, 배점 변경 후 과거 점수 유지, 학생 이동 후 행사 명단 보존을 실제 서비스에서 검사합니다.

## 운영 백업 복원본

운영 백업은 같은 컴퓨터의 별도 `newave_migration_...` DB에 복원합니다. `createMigrationBaseline`과 합성 fixture는 실행하지 않습니다. `MIGRATION_SYNTHETIC_FIXTURE=false`로 같은 `PostgresMigrationTest`를 실행하면 원본 해시·집계·롤백·재실행 거절·앱 기동 검사를 수행합니다. 개인정보 행은 출력하지 않습니다. 합성 사례의 고정 ID를 사용하는 업무 저장 검사는 생략합니다.

2026-10-10 합성 자료 검증 환경: PostgreSQL 17.10, JDK 21. CI는 PostgreSQL 17·18과 JDK 17을 사용합니다. 포터블 로컬 DB 도구는 [embedded-postgres 배포](https://github.com/leinelissen/embedded-postgres), PostgreSQL 18.6과 복원 클라이언트는 [PostgreSQL에서 안내하는 EDB 배포](https://www.postgresql.org/download/windows/)를 사용했습니다. 검증 파일·실행 도구·접속값·DB 저장 폴더는 `backend/.verification/`에 두며 Git에서 제외합니다.

운영 PostgreSQL 18.6의 읽기 전용 백업을 이 PC의 별도 PostgreSQL 18.6에 복원하고, `MIGRATION_SYNTHETIC_FIXTURE=false` 검사도 통과했습니다. 백업은 서버의 `pg_dump -Fc`를 SSH로 실행해 받았으며, 임시 SSH 키는 백업 직후 등록 해제하고 로컬 키 파일도 삭제했습니다. 복원은 `pg_restore --no-owner --no-privileges --exit-on-error --single-transaction`을 사용했습니다. 원본 백업과 검사 로그는 비공개 로컬 검증 폴더에 보관하며, 운영 DB에는 전환 SQL을 실행하지 않았습니다.
