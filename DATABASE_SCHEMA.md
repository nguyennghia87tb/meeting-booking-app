# DATABASE_SCHEMA

Supabase (PostgreSQL). Mã tạo bảng nằm trong `supabase_schema.sql`.

## ENUM

| Tên | Giá trị |
|---|---|
| `meeting_type_enum` | `ONLINE`, `OFFLINE` |
| `booking_status_enum` | `CONFIRMED`, `WAITING`, `CANCELLED` |
| `booking_action_enum` | `CREATED`, `CONFIRMED`, `CANCELLED`, `PROMOTED` |

## Quan hệ

```
departments 1 ──< bookings >── 0..1 meeting_rooms
                     1
                     │
                     └──< booking_logs
```

## `departments` — danh mục phòng ban
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT identity, PK | |
| `name` | TEXT, NOT NULL, UNIQUE | Tên phòng ban |

## `meeting_rooms` — danh mục phòng họp
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT identity, PK | |
| `name` | TEXT, NOT NULL, UNIQUE | Tên phòng họp |
| `capacity` | INTEGER, NULL | Sức chứa, phải > 0 nếu có |

## `bookings` — đăng ký cuộc họp (bảng trung tâm)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT identity, PK | |
| `full_name` | TEXT, NOT NULL | Họ tên người đăng ký |
| `department_id` | BIGINT, NOT NULL, FK → `departments.id` | |
| `room_id` | BIGINT, FK → `meeting_rooms.id` | NULL chỉ khi họp ONLINE |
| `meeting_type` | `meeting_type_enum`, NOT NULL | |
| `meeting_title` | TEXT, NOT NULL | |
| `start_time` | TIMESTAMPTZ, NOT NULL | |
| `end_time` | TIMESTAMPTZ, NOT NULL | Phải > `start_time` |
| `meet_url` | TEXT, NULL | Link Google Meet |
| `google_event_id` | TEXT, NULL | ID sự kiện Google Calendar |
| `status` | `booking_status_enum`, NOT NULL, mặc định `CONFIRMED` | |
| `queue_position` | INTEGER, NULL | Thứ tự trong hàng chờ (1 = ưu tiên nhất) |
| `created_at` | TIMESTAMPTZ, NOT NULL, mặc định `now()` | Mốc dùng để xếp ưu tiên |
| `cancelled_at` | TIMESTAMPTZ, NULL | |

### Ràng buộc nghiệp vụ (CHECK / EXCLUDE)
- `end_time > start_time`.
- `OFFLINE` bắt buộc có `room_id`.
- `queue_position` chỉ có giá trị khi `status = 'WAITING'`.
- `cancelled_at` có giá trị khi và chỉ khi `status = 'CANCELLED'`.
- **Chống trùng lịch:** `EXCLUDE USING gist` (cần `btree_gist`) — cùng một phòng không thể có hai booking `CONFIRMED` chồng khoảng thời gian `[start_time, end_time)`. Booking `WAITING` và `CANCELLED` không bị ràng buộc nên có thể xếp hàng chờ cùng khung giờ. Việc chặn nằm ở database nên an toàn khi nhiều người đăng ký đồng thời.

### Index
- `(room_id, start_time, end_time)` — tra cứu lịch theo phòng.
- `(room_id, start_time, queue_position)` WHERE `status = 'WAITING'` — lấy hàng chờ.
- `status`, `department_id`.

## `booking_logs` — lịch sử thay đổi
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | BIGINT identity, PK | |
| `booking_id` | BIGINT, NOT NULL, FK → `bookings.id` ON DELETE CASCADE | |
| `action` | `booking_action_enum`, NOT NULL | |
| `timestamp` | TIMESTAMPTZ, NOT NULL, mặc định `now()` | |

## Luồng trạng thái & hàng chờ
1. Đăng ký mới, phòng còn trống → `CONFIRMED` (log `CREATED`, `CONFIRMED`).
2. Phòng đã có `CONFIRMED` trùng giờ → `WAITING` với `queue_position` = số thứ tự kế tiếp (log `CREATED`).
3. Một booking `CONFIRMED` bị hủy → `CANCELLED` (log `CANCELLED`); booking `WAITING` có `queue_position` nhỏ nhất (cùng `created_at` sớm nhất) được nâng lên `CONFIRMED`, `queue_position = NULL` (log `PROMOTED`, `CONFIRMED`), các vị trí còn lại giảm 1.

Logic ở bước 2–3 sẽ được cài đặt ở bước sau (hàm Postgres/RPC để thực hiện nguyên tử).

## Bảo mật (RLS)
RLS được bật cho cả 4 bảng. Hiện chỉ `departments` và `meeting_rooms` cho phép đọc công khai; `bookings` và `booking_logs` sẽ có policy ở bước API/xác thực.
