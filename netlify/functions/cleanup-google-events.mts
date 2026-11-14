// Netlify Scheduled Function: tự chạy theo lịch, không có địa chỉ công khai để người ngoài gọi.
// Dùng chung biến môi trường của site trên Netlify (Supabase + Google).
import { cleanupPastGoogleEvents } from "../../lib/bookings/cleanupPastEvents";

// Cú pháp cron tính theo giờ UTC: 17:00 UTC = 00:00 (nửa đêm) giờ Việt Nam, mỗi ngày một lần.
export const config = {
  schedule: "0 17 * * *",
};

export default async function handler(): Promise<Response> {
  try {
    const result = await cleanupPastGoogleEvents();
    console.log("[Cleanup] Dọn sự kiện Google của các cuộc họp đã kết thúc:", JSON.stringify(result));
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error(
      "[Cleanup] Tác vụ dọn sự kiện Google thất bại:",
      err instanceof Error ? err.message : err
    );
    return new Response("cleanup failed", { status: 500 });
  }
}
