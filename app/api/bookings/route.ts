import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createGoogleMeetEvent, deleteGoogleCalendarEvent } from "@/lib/googleCalendar";
import { validateBookingInput, type BookingInput } from "@/lib/bookings/validate";
import type { Booking } from "@/types/database";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Xác định trạng thái cho booking mới.
 * - Họp ONLINE: không dùng phòng nên luôn CONFIRMED.
 * - OFFLINE: tìm booking CONFIRMED/WAITING cùng phòng có khoảng thời gian chồng lấn
 *   (existing.start < new.end VÀ existing.end > new.start). Có trùng -> WAITING,
 *   queue_position = số người đang WAITING trong khung giờ đó + 1.
 */
async function decideStatus(input: BookingInput) {
  if (input.meeting_type === "ONLINE") {
    return { status: "CONFIRMED" as const, queue_position: null };
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("bookings")
    .select("id, status")
    .eq("room_id", input.room_id)
    .in("status", ["CONFIRMED", "WAITING"])
    .lt("start_time", input.end_time)
    .gt("end_time", input.start_time);

  if (error) throw error;

  const overlaps = data ?? [];
  if (overlaps.length === 0) {
    return { status: "CONFIRMED" as const, queue_position: null };
  }
  const waiting = overlaps.filter((o) => o.status === "WAITING").length;
  return { status: "WAITING" as const, queue_position: waiting + 1 };
}

export async function POST(request: Request) {
  // 1. Đọc và kiểm tra dữ liệu
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Dữ liệu gửi lên không phải JSON hợp lệ.", 400);
  }
  const parsed = validateBookingInput(body);
  if (!parsed.ok) return fail(parsed.message, 400);
  const input = parsed.data;

  try {
    const admin = getSupabaseAdmin();

    // 2-3. Kiểm tra trùng + lưu. Nếu hai người đăng ký cùng lúc, ràng buộc EXCLUDE
    // của DB (mã 23P01) chặn người đến sau; khi đó tính lại và lưu thành WAITING.
    let booking: Booking | null = null;
    for (let attempt = 0; attempt < 2 && !booking; attempt++) {
      const { status, queue_position } = await decideStatus(input);
      const { data, error } = await admin
        .from("bookings")
        .insert({ ...input, status, queue_position })
        .select()
        .single();

      if (!error) {
        booking = data as Booking;
      } else if (error.code !== "23P01" || attempt === 1) {
        throw error;
      }
    }
    if (!booking) return fail("Không thể lưu đăng ký, vui lòng thử lại.", 500);

    // 4. Ghi log; nếu lỗi thì hoàn tác booking vừa tạo để dữ liệu nhất quán
    const { error: logError } = await admin
      .from("booking_logs")
      .insert({ booking_id: booking.id, action: "CREATED" });
    if (logError) {
      await admin.from("bookings").delete().eq("id", booking.id);
      throw logError;
    }

    // 5. Họp ONLINE: tạo link Google Meet rồi lưu vào meet_url.
    // Lỗi ở bước này KHÔNG làm hỏng đăng ký: booking vẫn giữ, meet_url để null, trả về cảnh báo.
    let warning: string | null = null;
    if (booking.meeting_type === "ONLINE") {
      try {
        const { meetUrl, eventId } = await createGoogleMeetEvent(
          booking.meeting_title,
          booking.start_time,
          booking.end_time,
          `Người đăng ký: ${booking.full_name}`
        );
        // Lưu cả mã sự kiện Google để sau này hủy lịch thì xóa được sự kiện trên Google Calendar
        const { data: updated, error: updateError } = await admin
          .from("bookings")
          .update({ meet_url: meetUrl, google_event_id: eventId })
          .eq("id", booking.id)
          .select()
          .single();
        if (updateError) {
          // Google đã tạo link nhưng không ghi được vào DB: log riêng để phân biệt với lỗi từ Google
          console.error("[GoogleCalendar] Đã có link Meet nhưng lưu meet_url vào DB lỗi:", updateError);
          // Không lưu được mã sự kiện thì về sau không xóa được, nên dọn sự kiện vừa tạo ngay bây giờ
          await deleteGoogleCalendarEvent(eventId).catch(() => {});
          throw updateError;
        }
        booking = updated as Booking;
      } catch (meetErr) {
        console.error("[GoogleCalendar] Không tạo/lưu được link Google Meet:", meetErr);
        warning =
          "Đăng ký đã được lưu nhưng chưa tạo được link Google Meet. Vui lòng liên hệ quản trị để được cấp link.";
      }
    }

    // 6. Làm mới trang chủ để danh sách lịch họp hiện ngay đăng ký vừa tạo
    revalidatePath("/");

    return NextResponse.json({ booking, warning }, { status: 200 });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("POST /api/bookings lỗi:", err);

    if (e.code === "23503") {
      return fail("Phòng ban hoặc phòng họp không tồn tại.", 400);
    }
    if (e.code === "23514") {
      return fail("Dữ liệu đăng ký không hợp lệ.", 400);
    }
    if (e.code === "42501") {
      return fail(
        "Máy chủ chưa có quyền ghi dữ liệu. Hãy chạy supabase/grants_service_role.sql trên Supabase.",
        500
      );
    }
    if (e.message?.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return fail("Máy chủ chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trong .env.local.", 500);
    }
    return fail("Không thể lưu đăng ký, vui lòng thử lại sau.", 500);
  }
}
