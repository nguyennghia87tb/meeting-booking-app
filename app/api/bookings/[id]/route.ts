import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cancelBooking } from "@/lib/bookings/cancel";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** PATCH /api/bookings/:id — hủy booking và đôn người từ hàng chờ (nếu có). */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) <= 0) {
      return fail("Mã lịch họp không hợp lệ.", 400);
    }

    const result = await cancelBooking(Number(rawId));

    if (result.kind === "not_found") {
      return fail("Không tìm thấy lịch họp.", 404);
    }
    if (result.kind === "already_cancelled") {
      return fail("Lịch họp này đã được hủy trước đó.", 409);
    }

    // Làm mới trang chủ để danh sách hiện đúng trạng thái sau khi hủy/đôn
    revalidatePath("/");

    return NextResponse.json(
      {
        message: result.promoted
          ? `Đã hủy lịch họp. ${result.promoted.full_name} đã được đôn từ hàng chờ lên lịch chính thức.`
          : "Đã hủy lịch họp.",
        cancelled: result.cancelled,
        promoted: result.promoted,
        warnings: result.warnings,
      },
      { status: 200 }
    );
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("PATCH /api/bookings/[id] lỗi:", err);

    if (e.code === "42501") {
      return fail(
        "Máy chủ chưa có quyền ghi dữ liệu. Hãy chạy supabase/grants_service_role.sql trên Supabase.",
        500
      );
    }
    if (e.message?.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return fail("Máy chủ chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trong .env.local.", 500);
    }
    return fail("Không thể hủy lịch họp, vui lòng thử lại sau.", 500);
  }
}
