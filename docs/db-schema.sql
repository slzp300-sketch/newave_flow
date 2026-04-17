-- Newave Flow DB Schema (MySQL 8.0+)
-- 인코딩: UTF8MB4

CREATE DATABASE IF NOT EXISTS newave_flow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE newave_flow;

-- 사용자 (목사님/임원/교사)
CREATE TABLE users (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(50)  NOT NULL,
    email      VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       ENUM('PASTOR', 'EXECUTIVE', 'TEACHER') NOT NULL DEFAULT 'TEACHER',
    phone      VARCHAR(20),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 반 (유치부, 초등부 1반 등)
CREATE TABLE class_groups (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    age_group   VARCHAR(50),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 교사-반 매핑 (한 교사가 여러 반 담당 가능)
CREATE TABLE teacher_classes (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id     BIGINT  NOT NULL,
    class_group_id BIGINT  NOT NULL,
    is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (teacher_id)     REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (class_group_id) REFERENCES class_groups(id) ON DELETE CASCADE,
    UNIQUE KEY uk_teacher_class (teacher_id, class_group_id)
);

-- 학생
CREATE TABLE students (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(50)  NOT NULL,
    class_group_id BIGINT       NOT NULL,
    grade          VARCHAR(20),
    birth_date     DATE,
    parent_name    VARCHAR(50),
    parent_phone   VARCHAR(20),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_group_id) REFERENCES class_groups(id)
);

-- 학생 출석 (주일 출석)
CREATE TABLE attendances (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id      BIGINT NOT NULL,
    class_group_id  BIGINT NOT NULL,
    teacher_id      BIGINT NOT NULL,
    attendance_date DATE   NOT NULL,
    status          ENUM('PRESENT', 'ABSENT', 'LATE') NOT NULL DEFAULT 'ABSENT',
    note            VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id)     REFERENCES students(id)     ON DELETE CASCADE,
    FOREIGN KEY (class_group_id) REFERENCES class_groups(id),
    FOREIGN KEY (teacher_id)     REFERENCES users(id),
    UNIQUE KEY uk_attendance (student_id, attendance_date)
);

-- 교사 회의 참석 (매주 토요일)
CREATE TABLE meeting_attendances (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id   BIGINT NOT NULL,
    meeting_date DATE   NOT NULL,
    status       ENUM('PRESENT', 'ABSENT', 'LATE') NOT NULL DEFAULT 'ABSENT',
    note         VARCHAR(255),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    UNIQUE KEY uk_meeting (teacher_id, meeting_date)
);

-- 행사/일정
CREATE TABLE events (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    event_date  DATE         NOT NULL,
    event_type  ENUM('REGULAR', 'SPECIAL', 'MEETING') NOT NULL DEFAULT 'SPECIAL',
    created_by  BIGINT       NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 행사 참석
CREATE TABLE event_attendances (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id   BIGINT NOT NULL,
    teacher_id BIGINT NOT NULL,
    status     ENUM('PRESENT', 'ABSENT') NOT NULL DEFAULT 'ABSENT',
    note       VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id)   REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    UNIQUE KEY uk_event_attendance (event_id, teacher_id)
);

-- 체크리스트 항목 템플릿 (관리자 설정)
CREATE TABLE checklist_items (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    category    VARCHAR(50),
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INT     NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- 일일 체크리스트 기록
CREATE TABLE daily_checklist_records (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id        BIGINT  NOT NULL,
    checklist_item_id BIGINT  NOT NULL,
    record_date       DATE    NOT NULL,
    is_checked        BOOLEAN NOT NULL DEFAULT FALSE,
    note              VARCHAR(255),
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id)        REFERENCES users(id),
    FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id),
    UNIQUE KEY uk_checklist_record (teacher_id, checklist_item_id, record_date)
);

-- 일일 보고서
CREATE TABLE daily_reports (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id     BIGINT NOT NULL,
    class_group_id BIGINT NOT NULL,
    report_date    DATE   NOT NULL,
    status         ENUM('DRAFT', 'SUBMITTED') NOT NULL DEFAULT 'DRAFT',
    total_students INT    NOT NULL DEFAULT 0,
    present_count  INT    NOT NULL DEFAULT 0,
    absent_count   INT    NOT NULL DEFAULT 0,
    late_count     INT    NOT NULL DEFAULT 0,
    special_notes  TEXT,
    submitted_at   TIMESTAMP,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id)     REFERENCES users(id),
    FOREIGN KEY (class_group_id) REFERENCES class_groups(id),
    UNIQUE KEY uk_daily_report (teacher_id, class_group_id, report_date)
);

-- ──────────── 샘플 데이터 ────────────
INSERT INTO class_groups (name, description, age_group) VALUES
  ('유치부',      '5~7세',   '유치'),
  ('초등부 1반',  '초등 1~2학년', '초등'),
  ('초등부 2반',  '초등 3~4학년', '초등'),
  ('중등부',      '중학생',  '중등');

-- 비밀번호: password123 (BCrypt)
INSERT INTO users (name, email, password, role, phone) VALUES
  ('김목사', 'pastor@church.com',    '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBauj3pPsEbBQ2', 'PASTOR',    '010-1234-5678'),
  ('이임원', 'exec@church.com',     '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBauj3pPsEbBQ2', 'EXECUTIVE', '010-2345-6789'),
  ('박교사', 'teacher1@church.com', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBauj3pPsEbBQ2', 'TEACHER',   '010-3456-7890'),
  ('최교사', 'teacher2@church.com', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBauj3pPsEbBQ2', 'TEACHER',   '010-4567-8901');

INSERT INTO teacher_classes (teacher_id, class_group_id, is_primary) VALUES
  (3, 1, TRUE), (4, 2, TRUE);

INSERT INTO students (name, class_group_id, grade, parent_name, parent_phone) VALUES
  ('김민준', 1, '7세', '김철수', '010-1111-1111'),
  ('이서연', 1, '6세', '이영희', '010-2222-2222'),
  ('박지호', 1, '5세', '박준혁', '010-3333-3333'),
  ('최유나', 2, '초2', '최미라', '010-4444-4444'),
  ('정태양', 2, '초1', '정석준', '010-5555-5555');

INSERT INTO checklist_items (title, category, is_required, order_index) VALUES
  ('학생 개인 연락 (결석자)',    '연락',   TRUE,  1),
  ('부모님 연락 (필요시)',       '연락',   FALSE, 2),
  ('주간 교안 준비',             '준비',   TRUE,  3),
  ('교실 정리정돈',              '환경',   FALSE, 4),
  ('다음 주 특이사항 보고',      '보고',   TRUE,  5);
