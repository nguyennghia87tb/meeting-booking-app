// Dùng đường dẫn tương đối (không dùng "@/") vì file này còn được Netlify Scheduled Function
// đóng gói riêng, ngoài Next.js, nơi bí danh "@/" có thể không được hiểu.
import { deleteGoogleCalendarEvent } from "../googleCalendar";
import { getSupabaseAdmin } from "../supabase/admin";

// Mỗi lần chạy xử lý tối đa bấy nhiêu lịch và dừng trước giới hạn 30 giây của Netlify.
// Phần còn lại (nếu có) sẽ được lần chạy sau xử lý tiếp.
const MAX_PER_RUN = 50;
const TIME_BUDGET_MS = 20_000;

export interface CleanupResult {
  /** Số lịch đã qua giờ kết thúc còn sự kiện trên Google */
  found: number;
  /** Số sự kiện đã xóa trên Google và đã xóa mã trong DB */
  deleted: number;
  /** Số sự kiện xóa lỗi (giữ nguyên mã để lần sau thử lại) */
  failed: number;
  /** Số lịch chưa kịp xử lý trong lần chạy này */
  skipped: number;
}

/**
 * Dọn các sự kiện Google Calendar của những cuộc họp ONLINE đã kết thúc.
 *
 * Tìm booking thỏa ĐỒNG THỜI: meeting_type = ONLINE, status khác CANCELLED,
 * end_time < bây giờ, google_event_id khác null. Với mỗi booking: xóa sự kiện trên Google;
 * xóa thành công thì đặt google_event_id = null để lần chạy sau không quét lại.
 * Xóa lỗi thì giữ nguyên mã và ghi log, lần chạy sau sẽ thử lại.
 */
export async function cleanupPastGoogleEvents(): Promise<CleanupResult> {
  const startedAt = Date.now();
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("bookings")
    .select("id, google_event_id")
    .eq("meeting_type", "ONLINE")
    .neq("status", "CANCELLED")
    .lt("end_time", new Date().toISOString())
    .not("google_event_id", "is", null)
    .order("end_time", { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) throw error;

  const rows = (data ?? []) as { id: number; google_event_id: string | null }[];
  const result: CleanupResult = { found: rows.length, deleted: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    if (!row.google_event_id) continue;
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      result.skipped++;
      continue;
    }

    try {
      // Hàm này tự ghi log "[GoogleCalendar] Lỗi xóa sự kiện" khi Google từ chối
      await deleteGoogleCalendarEvent(row.google_event_id);
    } catch {
      result.failed++;
      continue;
    }

    // Chỉ xóa mã khi nó vẫn đúng là mã vừa xóa (tránh ghi đè nếu dữ liệu vừa bị đổi)
    const { error: updateError } = await admin
      .from("bookings")
      .update({ google_event_id: null })
      .eq("id", row.id)
      .eq("google_event_id", row.google_event_id);
    if (updateError) {
      // Sự kiện đã xóa trên Google; lần sau quét lại thì Google báo "không còn" và được coi là xong
      console.error(`[Cleanup] Đã xóa sự kiện nhưng chưa cập nhật được lịch #${row.id}:`, updateError);
      result.failed++;
      continue;
    }
    result.deleted++;
  }

  return result;
}
