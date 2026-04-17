# Newave Flow API 명세

Base URL: `http://localhost:8080/api`  
인증: `Authorization: Bearer {accessToken}`

---

## Auth

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| POST | `/auth/login` | 없음 | 이메일+비밀번호 로그인 |
| POST | `/auth/refresh` | 없음 | 토큰 갱신 |
| POST | `/auth/logout` | 인증 | 로그아웃 |

**POST /auth/login**
```json
// Request
{ "email": "teacher@church.com", "password": "password123" }

// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": 3,
    "name": "박교사",
    "role": "TEACHER",
    "email": "teacher@church.com"
  }
}
```

---

## Users

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/users/me` | 인증 | 내 정보 조회 |
| GET | `/users` | PASTOR/EXECUTIVE | 전체 사용자 목록 |
| POST | `/users` | PASTOR | 사용자 생성 |
| PUT | `/users/{id}` | PASTOR | 사용자 수정 |
| DELETE | `/users/{id}` | PASTOR | 사용자 삭제 |

---

## ClassGroups (반)

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/classes` | 인증 | 반 목록 (TEACHER: 담당 반만) |
| POST | `/classes` | PASTOR | 반 생성 |
| GET | `/classes/{id}/students` | 인증 | 반 학생 목록 |

---

## Attendance (학생 출석)

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/attendance` | 인증 | 출석 조회 (`?classId=&date=`) |
| POST | `/attendance/batch` | TEACHER | 출석 일괄 저장 |
| GET | `/attendance/summary` | PASTOR/EXEC | 출석 요약 (`?date=`) |

**POST /attendance/batch**
```json
// Request
{
  "classGroupId": 1,
  "attendanceDate": "2024-01-15",
  "records": [
    { "studentId": 1, "status": "PRESENT", "note": "" },
    { "studentId": 2, "status": "ABSENT",  "note": "감기" },
    { "studentId": 3, "status": "LATE",    "note": "" }
  ]
}

// Response 200
{ "saved": 3, "date": "2024-01-15" }
```

**GET /attendance?classId=1&date=2024-01-15**
```json
[
  { "studentId": 1, "studentName": "김민준", "status": "PRESENT", "note": "" },
  { "studentId": 2, "studentName": "이서연", "status": "ABSENT",  "note": "감기" }
]
```

---

## Meeting Attendance (교사 회의)

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/meetings/attendance` | PASTOR/EXEC | 회의 출석 조회 (`?date=`) |
| POST | `/meetings/attendance` | TEACHER | 회의 참석 체크 |

---

## Events (행사)

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/events` | 인증 | 행사 목록 (`?from=&to=`) |
| POST | `/events` | PASTOR/EXEC | 행사 생성 |
| GET | `/events/{id}` | 인증 | 행사 상세 |
| POST | `/events/{id}/attendance` | TEACHER | 행사 참석 체크 |
| GET | `/events/{id}/attendance` | PASTOR/EXEC | 행사 참석 현황 |

---

## Checklist

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/checklist/items` | 인증 | 체크리스트 항목 목록 |
| GET | `/checklist/records` | TEACHER | 내 기록 조회 (`?date=`) |
| POST | `/checklist/records` | TEACHER | 체크리스트 기록 저장 |

---

## Reports (일일 보고)

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| GET | `/reports` | 인증 | 보고서 목록 (`?date=&teacherId=`) |
| POST | `/reports` | TEACHER | 보고서 초안 저장 |
| PUT | `/reports/{id}/submit` | TEACHER | 보고서 제출 |
| GET | `/reports/summary` | PASTOR/EXEC | 제출 현황 요약 (`?date=`) |

**GET /reports/summary?date=2024-01-15**
```json
{
  "date": "2024-01-15",
  "totalTeachers": 12,
  "submitted": 8,
  "notSubmitted": [
    { "teacherId": 3, "teacherName": "박교사", "className": "유치부" },
    { "teacherId": 4, "teacherName": "최교사", "className": "초등부 2반" }
  ]
}
```

---

## 공통 에러 형식

```json
{
  "status": 400,
  "error": "BAD_REQUEST",
  "message": "출석 날짜는 필수입니다.",
  "timestamp": "2024-01-15T10:30:00"
}
```

| 코드 | 의미 |
|------|------|
| 400 | 잘못된 요청 (유효성 검사 실패) |
| 401 | 인증 실패 (토큰 없음/만료) |
| 403 | 권한 없음 (역할 불일치) |
| 404 | 리소스 없음 |
| 409 | 충돌 (이미 존재) |
| 500 | 서버 오류 |
