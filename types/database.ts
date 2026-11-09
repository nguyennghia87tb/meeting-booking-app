// Types khớp với supabase_schema.sql

// ----- ENUM -----
export type MeetingType = "ONLINE" | "OFFLINE";
export type BookingStatus = "CONFIRMED" | "WAITING" | "CANCELLED";
export type BookingAction = "CREATED" | "CONFIRMED" | "CANCELLED" | "PROMOTED";

// ----- Bảng departments -----
export interface Department {
  id: number;
  name: string;
}

// ----- Bảng meeting_rooms -----
export interface MeetingRoom {
  id: number;
  name: string;
  capacity: number | null;
}

// ----- Bảng bookings -----
// Các cột TIMESTAMPTZ được Supabase trả về dạng chuỗi ISO 8601.
export interface Booking {
  id: number;
  full_name: string;
  department_id: number;
  /** NULL chỉ hợp lệ khi meeting_type = 'ONLINE' */
  room_id: number | null;
  meeting_type: MeetingType;
  meeting_title: string;
  start_time: string;
  end_time: string;
  meet_url: string | null;
  google_event_id: string | null;
  status: BookingStatus;
  /** Chỉ có giá trị khi status = 'WAITING' */
  queue_position: number | null;
  created_at: string;
  /** Có giá trị khi và chỉ khi status = 'CANCELLED' */
  cancelled_at: string | null;
}

/**
 * Dữ liệu để insert booking: bỏ id và created_at (DB tự sinh).
 * Các trường có DEFAULT hoặc nullable được để tùy chọn.
 */
export type NewBooking = Omit<
  Booking,
  | "id"
  | "created_at"
  | "room_id"
  | "meet_url"
  | "google_event_id"
  | "status"
  | "queue_position"
  | "cancelled_at"
> &
  Partial<
    Pick<
      Booking,
      | "room_id"
      | "meet_url"
      | "google_event_id"
      | "status"
      | "queue_position"
      | "cancelled_at"
    >
  >;

// ----- Bảng booking_logs -----
export interface BookingLog {
  id: number;
  booking_id: number;
  action: BookingAction;
  timestamp: string;
}
