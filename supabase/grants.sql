-- Cấp quyền đọc cho vai trò anon/authenticated.
-- Lỗi "permission denied for table ..." nghĩa là bảng chưa được GRANT cho các vai trò này
-- (RLS policy chỉ có tác dụng khi vai trò đã có quyền ở mức bảng).
-- Chạy trong Supabase SQL Editor, chạy lại nhiều lần không lỗi.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON departments, meeting_rooms, bookings TO anon, authenticated;

-- Cho phép đọc công khai danh sách đăng ký để trang chủ hiển thị lịch họp.
-- (Ghi dữ liệu sẽ được cấp quyền riêng ở bước tạo booking.)
DROP POLICY IF EXISTS "public read bookings" ON bookings;
CREATE POLICY "public read bookings" ON bookings FOR SELECT USING (true);
