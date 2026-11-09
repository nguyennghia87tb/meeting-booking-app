import { connection, NextResponse } from "next/server";
import { getDepartments } from "@/lib/supabase/queries";

/** Kiểm tra kết nối Supabase bằng cách đọc bảng departments. */
export async function GET() {
  // Với cacheComponents, connection() đảm bảo route chỉ chạy lúc có request (không prerender)
  await connection();
  try {
    await getDepartments();
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
