import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Booking } from "@/types/database";

export type CancelResult =
  | { kind: "not_found" }
  | { kind: "already_cancelled" }
  | {
      kind: "ok";
      cancelled: Booking;
      /** Booking WAITING vừa được đôn lên CONFIRMED (nếu có) */
      promoted: Booking | null;
      /** Các bước phụ (ghi log, đánh lại số thứ tự) bị lỗi nhưng không làm hỏng việc hủy */
      warnings: string[];
    };

/**
 * Hủy booking và (nếu cần) đôn người đầu hàng chờ lên.
 *
 * 1. Chuyển booking sang CANCELLED, gán cancelled_at, xóa queue_position.
 *    Câu UPDATE có điều kiện status IN (CONFIRMED, WAITING) nên hủy hai lần
 *    không chạy lại logic đôn người.
 * 2. Ghi log CANCELLED.
 * 3. Nếu booking vừa hủy là CONFIRMED (và có phòng): lấy các booking WAITING cùng
 *    phòng có khung giờ chồng lấn với nó, xếp theo queue_position rồi created_at.
 *    Duyệt từ đầu hàng: người đầu tiên mà khung giờ của họ không còn vướng booking
 *    CONFIRMED nào khác sẽ được đôn lên CONFIRMED, queue_position = null, ghi log PROMOTED.
 *    (Người chờ có thể chỉ chồng một phần với booking vừa hủy, nên phải kiểm tra lại.)
 * 4. Đánh lại số thứ tự 1..n cho những người còn chờ trong cùng khung giờ.
 */
export async function cancelBooking(id: number): Promise<CancelResult> {
  const admin = getSupabaseAdmin();
  const warnings: string[] = [];

  const { data: existing, error: findError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return { kind: "not_found" };
  const original = existing as Booking;
  if (original.status === "CANCELLED") return { kind: "already_cancelled" };

  // Bước 1: hủy
  const { data: cancelledRow, error: cancelError } = await admin
    .from("bookings")
    .update({
      status: "CANCELLED",
      cancelled_at: new Date().toISOString(),
      queue_position: null,
    })
    .eq("id", id)
    .in("status", ["CONFIRMED", "WAITING"])
    .select()
    .maybeSingle();
  if (cancelError) throw cancelError;
  if (!cancelledRow) return { kind: "already_cancelled" }; // có người khác vừa hủy
  const cancelled = cancelledRow as Booking;

  // Bước 2: log
  const { error: logError } = await admin
    .from("booking_logs")
    .insert({ booking_id: id, action: "CANCELLED" });
  if (logError) {
    console.error("Không ghi được log CANCELLED:", logError);
    warnings.push("Đã hủy lịch nhưng chưa ghi được lịch sử thay đổi.");
  }

  // Bước 3-4: đôn hàng chờ (lỗi ở đây không được làm mất kết quả hủy)
  let promoted: Booking | null = null;
  if (original.room_id !== null) {
    try {
      const roomId = original.room_id;

      const waitingQuery = () =>
        admin
          .from("bookings")
          .select("*")
          .eq("room_id", roomId)
          .eq("status", "WAITING")
          .lt("start_time", original.end_time)
          .gt("end_time", original.start_time)
          .order("queue_position", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });

      if (original.status === "CONFIRMED") {
        const { data: waiting, error: waitError } = await waitingQuery();
        if (waitError) throw waitError;

        for (const candidate of (waiting ?? []) as Booking[]) {
          // Khung giờ của người chờ còn vướng booking CONFIRMED khác không?
          const { data: blockers, error: blockError } = await admin
            .from("bookings")
            .select("id")
            .eq("room_id", roomId)
            .eq("status", "CONFIRMED")
            .lt("start_time", candidate.end_time)
            .gt("end_time", candidate.start_time)
            .limit(1);
          if (blockError) throw blockError;
          if (blockers && blockers.length > 0) continue;

          const { data: updated, error: promoteError } = await admin
            .from("bookings")
            .update({ status: "CONFIRMED", queue_position: null })
            .eq("id", candidate.id)
            .eq("status", "WAITING")
            .select()
            .maybeSingle();
          if (promoteError) {
            if (promoteError.code === "23P01") continue; // vừa bị người khác chiếm chỗ
            throw promoteError;
          }
          if (!updated) continue;

          promoted = updated as Booking;
          const { error: promoLogError } = await admin
            .from("booking_logs")
            .insert({ booking_id: candidate.id, action: "PROMOTED" });
          if (promoLogError) {
            console.error("Không ghi được log PROMOTED:", promoLogError);
            warnings.push("Đã đôn người chờ lên nhưng chưa ghi được lịch sử thay đổi.");
          }
          break;
        }
      }

      // Đánh lại số thứ tự cho những người còn chờ trong cùng khung giờ
      const { data: remaining, error: remainError } = await waitingQuery();
      if (remainError) throw remainError;
      for (const [index, row] of ((remaining ?? []) as Booking[]).entries()) {
        if (row.queue_position === index + 1) continue;
        const { error: renumberError } = await admin
          .from("bookings")
          .update({ queue_position: index + 1 })
          .eq("id", row.id)
          .eq("status", "WAITING");
        if (renumberError) throw renumberError;
      }
    } catch (err) {
      console.error("Lỗi khi đôn hàng chờ:", err);
      warnings.push(
        "Đã hủy lịch nhưng việc đôn người từ hàng chờ gặp lỗi. Vui lòng kiểm tra lại danh sách."
      );
    }
  }

  return { kind: "ok", cancelled, promoted, warnings };
}
