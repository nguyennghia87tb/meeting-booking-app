import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHash, timingSafeEqual } from "node:crypto";
import { cancelBooking } from "@/lib/bookings/cancel";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// So sánh mật khẩu theo cách không để lộ thông tin qua thời gian phản hồi
function samePassword(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * PATCH /api/bookings/:id — hủy booking và đôn người từ hàng chờ (nếu có).
 * Body: { "password": "<mật khẩu quản trị>" }, so với biến môi trường ADMIN_DELETE_PASSWORD.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Kiểm tra mật khẩu quản trị TRƯỚC mọi thao tác với dữ liệu
  const adminPassword = process.env.ADMIN_DELETE_PASSWORD;
  if (!adminPassword) {
    console.error("Thiếu biến môi trường ADMIN_DELETE_PASSWORD.");
    return fail("Máy chủ chưa cấu hình mật khẩu quản trị (ADMIN_DELETE_PASSWORD).", 500);
  }
  const body: unknown = await request.json().catch(() => null);
  const password =
    body && typeof body === "object" ? (body as { password?: unknown }).password : undefined;
  if (typeof password !== "string" || !samePassword(password, adminPassword)) {
    return fail("Mật khẩu quản trị không đúng!", 403);
  }

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
