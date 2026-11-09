# PROJECT_PLAN — MEETING BOOKING SYSTEM

Hệ thống đăng ký phòng họp (VX Thanh Hóa) có xử lý ưu tiên và hàng chờ.

## Kiến trúc
- **Frontend + server:** Next.js (App Router) + TypeScript; route handlers / server actions cho nghiệp vụ.
- **UI:** Tailwind CSS.
- **Database:** Supabase (PostgreSQL) qua `@supabase/supabase-js`. Chống trùng lịch bằng ràng buộc `EXCLUDE` ở DB; nâng hàng chờ thực hiện nguyên tử bằng hàm Postgres (RPC).
- **Tích hợp:** Google Calendar / Google Meet cho họp ONLINE (`meet_url`, `google_event_id`).

```
Trình duyệt ──> Next.js (pages + API) ──> Supabase Postgres
                         └──────────────> Google Calendar API
```

## Các bước thực hiện
1. ✅ **Khởi tạo & CSDL (hoàn thành):** dự án Next.js, schema Supabase, client, biến môi trường.
2. ✅ **Dữ liệu mẫu & kiểu TypeScript (hoàn thành):** `types/database.ts`, `lib/supabase/queries.ts`, `supabase/seed.sql`, `GET /api/health`.
3. **Đăng ký cuộc họp:** form, kiểm tra hợp lệ, tạo `CONFIRMED` hoặc `WAITING`.
4. **Hàng chờ & ưu tiên:** hàm RPC hủy booking và tự động nâng (`PROMOTED`), ghi `booking_logs`.
5. **Giao diện lịch:** xem theo ngày/tuần, theo phòng, trạng thái từng booking.
6. **Google Calendar/Meet:** tạo sự kiện và link Meet cho họp ONLINE.
7. **Quản trị & phân quyền:** đăng nhập, RLS policy cho `bookings`, trang quản lý danh mục.
8. **Hoàn thiện:** thông báo, kiểm thử, triển khai (Vercel + Supabase).

## Cấu trúc thư mục
```
meeting-booking-app/
├─ app/                  # Next.js App Router
├─ lib/supabaseClient.ts # Khởi tạo Supabase
├─ supabase_schema.sql   # SQL tạo bảng
├─ DATABASE_SCHEMA.md    # Mô tả CSDL
├─ PROJECT_PLAN.md
└─ .env.local.example
```

## Cài đặt nhanh
1. Tạo project trên Supabase, chạy `supabase_schema.sql` trong SQL Editor.
2. `cp .env.local.example .env.local` và điền URL, anon key.
3. `npm install && npm run dev`.
