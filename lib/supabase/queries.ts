import type { Booking, Department, MeetingRoom } from "@/types/database";

// Nạp client theo kiểu lazy: supabaseClient.ts ném lỗi ngay khi import nếu thiếu env,
// nên không import tĩnh để `next build` không hỏng khi chưa có .env.local.
async function getClient() {
  const { supabase } = await import("@/lib/supabaseClient");
  return supabase;
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
