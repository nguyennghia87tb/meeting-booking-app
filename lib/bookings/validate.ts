import type { MeetingType } from "@/types/database";

export interface BookingInput {
  full_name: string;
  department_id: number;
  /** null với họp ONLINE */
  room_id: number | null;
  meeting_type: MeetingType;
  meeting_title: string;
  start_time: string; // ISO UTC
  end_time: string; // ISO UTC
}

export type ValidationResult =
  | { ok: true; data: BookingInput }
  | { ok: false; message: string };

const MAX_NAME = 100;
const MAX_TITLE = 200;

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

/** Kiểm tra và làm sạch body do client gửi lên; chỉ giữ lại các trường được phép. */
export function validateBookingInput(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Dữ liệu gửi lên không hợp lệ." };
  }
  const b = body as Record<string, unknown>;

  const fullName = typeof b.full_name === "string" ? b.full_name.trim() : "";
  if (!fullName) return { ok: false, message: "Vui lòng nhập họ và tên." };
  if (fullName.length > MAX_NAME) {
    return { ok: false, message: `Họ và tên tối đa ${MAX_NAME} ký tự.` };
  }

  const title = typeof b.meeting_title === "string" ? b.meeting_title.trim() : "";
  if (!title) return { ok: false, message: "Vui lòng nhập tiêu đề cuộc họp." };
  if (title.length > MAX_TITLE) {
    return { ok: false, message: `Tiêu đề tối đa ${MAX_TITLE} ký tự.` };
  }

  if (!isPositiveInt(b.department_id)) {
    return { ok: false, message: "Vui lòng chọn phòng ban." };
  }

  if (b.meeting_type !== "ONLINE" && b.meeting_type !== "OFFLINE") {
    return { ok: false, message: "Loại cuộc họp phải là ONLINE hoặc OFFLINE." };
  }
  const meetingType: MeetingType = b.meeting_type;

  // Họp ONLINE không dùng phòng: bỏ qua room_id client gửi
  let roomId: number | null = null;
  if (meetingType === "OFFLINE") {
    if (!isPositiveInt(b.room_id)) {
      return { ok: false, message: "Họp trực tiếp (OFFLINE) cần có phòng họp." };
    }
    roomId = b.room_id;
  }

  if (typeof b.start_time !== "string" || typeof b.end_time !== "string") {
    return { ok: false, message: "Vui lòng nhập thời gian bắt đầu và kết thúc." };
  }
  const start = Date.parse(b.start_time);
  const end = Date.parse(b.end_time);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { ok: false, message: "Thời gian không hợp lệ." };
  }
  if (end <= start) {
    return { ok: false, message: "Thời gian kết thúc phải sau thời gian bắt đầu." };
  }

  return {
    ok: true,
    data: {
      full_name: fullName,
      department_id: b.department_id,
      room_id: roomId,
      meeting_type: meetingType,
      meeting_title: title,
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
    },
  };
}
