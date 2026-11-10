import { randomUUID } from "node:crypto";
// Chỉ nạp phần Calendar của googleapis (thay vì cả thư viện) để gói deploy nhẹ hơn.
import { auth, calendar } from "googleapis/build/src/apis/calendar";

// CHỈ dùng ở server (API route). Không import file này vào component phía client.

const TIME_ZONE = "Asia/Ho_Chi_Minh";
// Giới hạn thời gian chờ Google để API đăng ký không bị treo
const TIMEOUT_MS = 8000;

// Xác thực bằng OAuth 2.0 với một tài khoản Google trung tâm: máy chủ giữ refresh token
// và thư viện tự đổi nó lấy access token mỗi khi cần.
function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  // Không khai báo GOOGLE_CALENDAR_ID thì dùng lịch chính của tài khoản trung tâm
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Thiếu biến môi trường GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET hoặc GOOGLE_REFRESH_TOKEN."
    );
  }
  return { clientId, clientSecret, refreshToken, calendarId };
}

/**
 * Tạo một sự kiện trên Google Calendar kèm phòng Google Meet và trả về link Meet.
 * Ném lỗi nếu thiếu cấu hình, Google từ chối, hoặc sự kiện tạo xong nhưng không có link Meet.
 *
 * @param title       Tiêu đề cuộc họp
 * @param startTime   Thời gian bắt đầu (chuỗi ISO)
 * @param endTime     Thời gian kết thúc (chuỗi ISO)
 * @param description Mô tả hiển thị trong sự kiện
 */
export async function createGoogleMeetEvent(
  title: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<string> {
  try {
    const { clientId, clientSecret, refreshToken, calendarId } = getConfig();

    const oauth2Client = new auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const client = calendar({ version: "v3", auth: oauth2Client });
    const res = await client.events.insert(
      {
        calendarId,
        conferenceDataVersion: 1, // bắt buộc để Google tạo phòng Meet
        requestBody: {
          summary: title,
          description,
          start: { dateTime: startTime, timeZone: TIME_ZONE },
          end: { dateTime: endTime, timeZone: TIME_ZONE },
          conferenceData: {
            createRequest: {
              requestId: randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        },
      },
      { timeout: TIMEOUT_MS }
    );

    const link =
      res.data.hangoutLink ??
      res.data.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ??
      null;

    if (!link) {
      throw new Error(
        `Google Calendar đã tạo sự kiện (id: ${res.data.id ?? "?"}) nhưng không trả về link Google Meet.`
      );
    }
    return link;
  } catch (err) {
    // Ghi log rõ nguyên nhân (KHÔNG in client secret hay refresh token) rồi ném tiếp để nơi gọi quyết định cách xử lý
    const e = err as { code?: number | string; message?: string; errors?: unknown };
    console.error("[GoogleCalendar] Tạo sự kiện Google Meet thất bại:", {
      title,
      startTime,
      endTime,
      code: e.code ?? null,
      message: e.message ?? String(err),
      details: e.errors ?? null,
    });
    throw err;
  }
}
