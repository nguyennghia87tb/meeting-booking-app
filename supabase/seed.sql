-- Dữ liệu thực tế của công ty. Chạy SAU supabase_schema.sql.
-- CẢNH BÁO: hai lệnh DELETE xóa toàn bộ danh mục cũ. Nếu đã có booking tham chiếu
-- tới phòng ban/phòng họp thì lệnh sẽ báo lỗi khóa ngoại (ON DELETE RESTRICT);
-- khi đó hãy xóa các booking đó trước.

DELETE FROM departments;
DELETE FROM meeting_rooms;

INSERT INTO departments (name) VALUES
  ('Phòng Kế Toán - Tài Chính'),
  ('Phòng Kế hoạch sản xuất'),
  ('Phòng Mua hàng'),
  ('Phòng kinh doanh'),
  ('Phòng vận hành kinh doanh'),
  ('Phòng HCNS'),
  ('Nhà máy 1'),
  ('Nhà máy 2'),
  ('Nhà máy 3')
ON CONFLICT (name) DO NOTHING;

INSERT INTO meeting_rooms (name, capacity) VALUES
  ('Phòng họp công ty', 50)
ON CONFLICT (name) DO NOTHING;
