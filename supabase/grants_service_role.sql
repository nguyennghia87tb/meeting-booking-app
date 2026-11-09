-- Cấp quyền ghi cho service_role (dùng bởi API route phía server).
-- service_role bỏ qua RLS nhưng vẫn cần quyền ở mức bảng. Chạy trong Supabase SQL Editor.
-- KHÔNG cấp quyền ghi cho anon/authenticated: mọi thao tác ghi đều đi qua API.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON departments, meeting_rooms, bookings, booking_logs
  TO service_role;

-- Cột id dạng IDENTITY cần quyền dùng sequence khi INSERT
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
