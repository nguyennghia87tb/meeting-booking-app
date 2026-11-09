-- =====================================================================
-- MEETING BOOKING SYSTEM - Supabase (PostgreSQL) schema
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor.
-- =====================================================================

-- Extension cần cho ràng buộc chống trùng lịch (EXCLUDE ... USING gist)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------
CREATE TYPE meeting_type_enum AS ENUM ('ONLINE', 'OFFLINE');
CREATE TYPE booking_status_enum AS ENUM ('CONFIRMED', 'WAITING', 'CANCELLED');
CREATE TYPE booking_action_enum AS ENUM ('CREATED', 'CONFIRMED', 'CANCELLED', 'PROMOTED');

-- ---------------------------------------------------------------------
-- departments: danh mục phòng ban
-- ---------------------------------------------------------------------
CREATE TABLE departments (
  id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- meeting_rooms: danh mục phòng họp
-- ---------------------------------------------------------------------
CREATE TABLE meeting_rooms (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  capacity  INTEGER CHECK (capacity IS NULL OR capacity > 0)
);

-- ---------------------------------------------------------------------
-- bookings: đăng ký cuộc họp
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name        TEXT NOT NULL,
  department_id    BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  -- Họp ONLINE có thể không cần phòng vật lý -> room_id cho phép NULL (xem CHECK bên dưới)
  room_id          BIGINT REFERENCES meeting_rooms(id) ON DELETE RESTRICT,
  meeting_type     meeting_type_enum NOT NULL,
  meeting_title    TEXT NOT NULL,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  meet_url         TEXT,
  google_event_id  TEXT,
  status           booking_status_enum NOT NULL DEFAULT 'CONFIRMED',
  queue_position   INTEGER CHECK (queue_position IS NULL OR queue_position > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at     TIMESTAMPTZ,

  CONSTRAINT bookings_time_valid CHECK (end_time > start_time),
  -- OFFLINE bắt buộc có phòng
  CONSTRAINT bookings_offline_needs_room CHECK (meeting_type = 'ONLINE' OR room_id IS NOT NULL),
  -- Chỉ booking WAITING mới có số thứ tự hàng chờ
  CONSTRAINT bookings_queue_only_waiting CHECK (status = 'WAITING' OR queue_position IS NULL),
  -- Booking CANCELLED phải có thời điểm hủy và ngược lại
  CONSTRAINT bookings_cancel_consistent CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),

  -- Chống trùng lịch: cùng một phòng không thể có 2 booking CONFIRMED chồng thời gian.
  -- WAITING / CANCELLED không bị ràng buộc (cho phép xếp hàng chờ cùng khung giờ).
  CONSTRAINT bookings_no_overlap_confirmed EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status = 'CONFIRMED' AND room_id IS NOT NULL)
);

-- Tra cứu lịch theo phòng + thời gian
CREATE INDEX idx_bookings_room_time ON bookings (room_id, start_time, end_time);
-- Lấy hàng chờ theo thứ tự ưu tiên
CREATE INDEX idx_bookings_waiting_queue ON bookings (room_id, start_time, queue_position)
  WHERE status = 'WAITING';
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_bookings_department ON bookings (department_id);

-- ---------------------------------------------------------------------
-- booking_logs: lịch sử thay đổi
-- ---------------------------------------------------------------------
CREATE TABLE booking_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id  BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action      booking_action_enum NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_logs_booking ON booking_logs (booking_id, "timestamp");

-- ---------------------------------------------------------------------
-- Row Level Security
-- Bật RLS; policy chi tiết sẽ được thêm ở bước xác thực/API sau.
-- (Khi bật RLS mà chưa có policy, anon key sẽ không đọc/ghi được -> an toàn mặc định.)
-- ---------------------------------------------------------------------
ALTER TABLE departments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_logs  ENABLE ROW LEVEL SECURITY;

-- Danh mục chỉ đọc công khai
CREATE POLICY "public read departments"   ON departments   FOR SELECT USING (true);
CREATE POLICY "public read meeting_rooms" ON meeting_rooms FOR SELECT USING (true);
