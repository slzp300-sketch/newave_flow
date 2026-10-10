# 코드 개선 배포·데이터 전환 점검표

2026-10-10. 로컬 변경을 운영에 적용할 때의 절차입니다. **PostgreSQL 17.10 합성 자료 검사와 운영 PostgreSQL 18.6 백업을 별도 로컬 PostgreSQL 18.6에 복원한 검사 모두 통과했습니다.** 원본 보고서 보관·출석/TTS 행 해시 대조·실패 롤백·재실행 거절·새 앱 `prod/validate` 기동까지 확인했습니다. 운영 DB 전환과 배포는 아직 실행하지 않았으며, 실제 반영 직전에 최신 백업을 다시 확보해야 합니다. 재현 방법은 [PostgreSQL 전환 검사](../backend/db/verification/README.md)를 참고하세요.

## 1. 먼저 별도 DB에서 검증

1. 운영 PostgreSQL 백업을 생성하고 복원 가능한지 확인합니다. 개인정보가 포함되므로 백업·원본 보고서·DB 연결값은 저장소나 작업 로그에 넣지 않습니다.
2. 접근을 제한한 별도 PostgreSQL에 백업을 복원하고 운영 앱과 분리합니다. 기존 테이블·열 이름이 SQL 전제와 일치하는지 확인합니다.
3. 전환 전 보고서 전체 건수, 반+날짜별 그룹 수, 행사 출석 건수, TTS 답변 건수·주간 점수를 내부에서 기록합니다. 학생·교사 명단을 출력하거나 외부로 옮길 필요는 없습니다.
4. 별도 DB의 앱 쓰기를 중지하고 `backend/db/migrations/V001__security_shared_reports_and_history.sql`을 오류 시 즉시 중단하는 설정으로 실행합니다. 예: 연결 환경변수를 별도 DB로 지정한 터미널에서 `psql -v ON_ERROR_STOP=1 -f backend/db/migrations/V001__security_shared_reports_and_history.sql`.
5. SQL은 한 트랜잭션으로 실행되며 `schema_migrations`에 완료 버전을 기록합니다. 같은 버전 재실행은 거절합니다. 부분 구조를 수동으로 만든 DB라면 충돌 원인을 먼저 확인하고 임의로 테이블을 삭제하지 않습니다.
6. 새 백엔드를 해당 별도 PostgreSQL에 연결해 `prod`와 `ddl-auto=validate`로 시작합니다. 누락 열·타입·제약 오류와 기존 데이터 호환성을 확인합니다. 기존 운영 DB에 자동 `update`를 켜서 우회하지 않습니다.

### 데이터 보존의 실제 기준

- `daily_reports_before_class_merge`: 전환 이전 보고서 원본을 전부 보관합니다. `daily_reports`는 반+날짜별 1건으로 합치며, 하나라도 제출이면 제출 완료, 메모는 중복을 제외해 병합, 작성자는 가장 최근 수정자로 정합니다. 인원은 실제 출석을 다시 집계합니다.
- `event_participants`: 전환 시점의 재적 학생·활성 교사를 기준으로 행사별 명단을 만듭니다. 실제 행사 출석이 있는 비활성 인원도 포함합니다. 출석 필요 표시를 나중에 껐더라도 출석 기록이 있으면 보존합니다. 최종 관리자는 교사 집계 대상에서 제외하는 기존 기준을 유지합니다.
- 과거 학생의 옛 이름·반·당시 재적 상태가 기존 DB에 남아 있지 않으면 복원할 수 없습니다. 기존 행사는 **전환 시점 기준선**, 새 출석 행사는 **등록 시점 명단**을 보존합니다. 새 행사 등록 후 추가된 인원은 자동 편입하지 않습니다.
- `tts_question_revisions`: 기존 항목의 현재 규칙을 최초 기준선으로 저장합니다. 이전에 덮어쓴 옛 배점을 복원하는 기능은 아닙니다. 전환 이후 변경부터 다음 주일 적용 이력을 보존합니다. 이전 주의 체크 자체는 계속 수정할 수 있으나 해당 주 배점으로 계산합니다.
- 원본 출석·TTS 답변은 전환 SQL이 수정하거나 삭제하지 않습니다. `completed_operations`와 `users.auth_version`은 중복 저장 방지와 세션 무효화에 사용합니다.

### 별도 DB에서 확인할 결과

```sql
-- 아래 중복 조회 결과는 0행이어야 합니다.
SELECT class_group_id, report_date, count(*)
FROM daily_reports GROUP BY class_group_id, report_date HAVING count(*) > 1;
SELECT event_id, kind, person_id, count(*)
FROM event_participants GROUP BY event_id, kind, person_id HAVING count(*) > 1;
SELECT question_id, effective_from, count(*)
FROM tts_question_revisions GROUP BY question_id, effective_from HAVING count(*) > 1;

-- 원본 보관 수 = 전환 전 보고서 수, 통합 후 수 = 전환 전 반+날짜 그룹 수.
SELECT count(*) AS original_reports FROM daily_reports_before_class_merge;
SELECT count(*) AS merged_reports FROM daily_reports;
SELECT version, applied_at FROM schema_migrations;
```

담임·부담임 한쪽 제출 후 양쪽 홈에서 완료 표시, 학생 반 이동/제적 전후 행사 인원 유지, TTS 배점 변경 후 과거 주 점수 유지, 일정 등록의 중복 요청 방지까지 가상/검수 계정으로 확인합니다. 저장 값과 업무 기준의 차이가 있으면 원인을 해결한 후 운영 반영을 진행합니다.

## 2. 운영 반영 순서

1. 위 별도 DB 검증 결과와 복원 가능한 백업을 확보합니다. PR/main 반영 방식은 사용자 결정 후 진행합니다.
2. 백엔드·프런트 자동 배포 시점을 맞춥니다. 쓰기를 잠시 중지하고 기존 서버를 멈춘 후 DB 전환을 실행합니다. main 푸시만 먼저 하면 자동 배포가 앞설 수 있습니다.
3. 운영 환경: `SPRING_PROFILES_ACTIVE=prod`, PostgreSQL `PG*`, 충분한 길이의 `JWT_SECRET`, 필요한 `VITE_API_URL`을 확인합니다. 초기화 옵션 `app.seed.enabled`는 켜지 않습니다. 실제 비밀값을 문서나 로그로 출력하지 않습니다.
   - 2026-10-10 Railway 읽기 점검: `prod`와 `PG*`는 설정되어 있고 초기화 활성화 설정은 없습니다. **`JWT_SECRET`은 누락되어 있으므로 새 코드 배포 전에 설정해야 합니다.** 임의 값은 최소 32바이트 이상이어야 하며 암호학적 난수로 생성합니다. 설정 변경 시 기존 세션 무효화와 재배포 시점을 함께 조율합니다. 이 점검에서는 운영 변수를 변경하지 않았습니다.
4. 새 백엔드 시작과 스키마 검사를 확인한 다음 새 프런트를 반영합니다. 토큰 형식 변경으로 기존 사용자는 한 번 재로그인해야 합니다. 설치형/PWA 사용자는 새 버전으로 새로고침합니다.
5. 운영에서는 실사용자의 저장·승인·삭제를 시험하지 않습니다. 로그인 화면, 읽기 화면, 401/403·서버 오류 현황을 확인하고 허가된 검수 계정의 테스트 범위만 사용합니다.

## 3. 실패·복원

- SQL 실행 중 오류: 커밋 전 전체 롤백됩니다. 오류를 수정하기 전에 대상 DB와 트랜잭션 결과를 확인합니다.
- 전환 후 앱 시작 실패: 쓰기 중지 상태를 유지하고 스키마/환경변수부터 확인합니다. 원본 보관 테이블은 삭제하지 않습니다.
- 이전 앱으로 복귀해야 하면 DB도 배포 전 백업으로 복원하는 계획이 필요합니다. 새 구조에 구버전을 그대로 연결하면 공동 보고서 충돌이 생길 수 있습니다. 단순 코드 롤백을 복구 완료로 보지 않습니다.
- 반영 후 새 데이터가 생겼다면 무조건 백업을 덮어쓰지 않습니다. 추가 입력을 별도로 보존하고 대조하는 복원 절차가 필요합니다.

## 4. 반복 가능한 로컬 검사

`frontend`: `npm test` 후 `npm run build -- --outDir .verification/build`.

`backend`: Java 17 이상에서 `./gradlew build --no-daemon` (Windows `gradlew.bat`). 검사는 H2와 가상 데이터만 사용합니다.

`.github/workflows/check.yml`에 같은 검사와 빌드, PostgreSQL 전환 검사를 추가했습니다. 코드 커밋 `4e8922a`는 [GitHub Actions의 3개 작업](https://github.com/slzp300-sketch/newave_flow/actions/runs/38047484045)을 모두 통과했습니다. 이후 변경은 해당 커밋의 검사 상태를 별도로 확인합니다. 로컬·CI 검사 성공이 운영 복원본 검사나 운영 SQL·배포까지 완료됐다는 뜻은 아닙니다.
