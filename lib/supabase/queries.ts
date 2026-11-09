import { createClient } from "@supabase/supabase-js";
import type { Booking, Department, MeetingRoom } from "@/types/database";

// Tạo client đọc dữ liệu (dùng anon key, chỉ có quyền đọc) theo kiểu lazy để
// `next build` không hỏng khi chưa có .env.local.
// Mọi yêu cầu gửi đi đều kèm cache: "no-store" để Next.js không giữ lại dữ liệu cũ,
// nhờ đó danh sách lịch họp luôn là dữ liệu mới nhất.
async function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createClient(url, anonKey, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

/** Lấy danh sách phòng ban, sắp xếp theo tên. */
export async function getDepartments(): Promise<Department[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Không thể lấy danh sách phòng ban: ${error.message}`);
  }
  return (data ?? []) as Department[];
}

/** Lấy danh sách phòng họp, sắp xếp theo tên. */
export async function getMeetingRooms(): Promise<MeetingRoom[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("meeting_rooms")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Không thể lấy danh sách phòng họp: ${error.message}`);
  }
  return (data ?? []) as MeetingRoom[];
}

/**
 * Lấy các booking bắt đầu trong ngày `date` (định dạng YYYY-MM-DD,
 * tính theo giờ Việt Nam UTC+7, từ 00:00 đến 23:59:59), sắp xếp theo start_time.
 */
export async function getBookingsByDate(date: string): Promise<Booking[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`Ngày không hợp lệ: "${date}". Định dạng đúng là YYYY-MM-DD.`);
  }

  const dayStart = `${date}T00:00:00+07:00`;
  const dayEnd = `${date}T23:59:59.999+07:00`;

  const supabase = await getClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Không thể lấy danh sách đăng ký ngày ${date}: ${error.message}`);
  }
  return (data ?? []) as Booking[];
}
