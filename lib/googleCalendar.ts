import { randomUUID } from "node:crypto";
// Chỉ nạp phần Calendar của googleapis (thay vì cả thư viện) để gói deploy nhẹ hơn.
import { auth, calendar } from "googleapis/build/src/apis/calendar";

// CHỈ dùng ở server (API route). Không import file này vào component phía client.

const TIME_ZONE = "Asia/Ho_Chi_Minh";
// Giới hạn thời gian chờ Google để API đăng ký không bị treo
const TIMEOUT_MS = 8000;

// Mã lịch CHỈ lấy từ biến môi trường GOOGLE_CALENDAR_ID. Nếu trống hoặc không có thì dùng
// "primary" = lịch chính của tài khoản Google trung tâm. Không gán cứng email nào trong code.
function getCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID?.trim() || "primary";
}

// Xác thực bằng OAuth 2.0 với một tài khoản Google trung tâm: máy chủ giữ refresh token
// và thư viện tự đổi nó lấy access token mỗi khi cần.
function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const calendarId = getCalendarId();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Thiếu biến môi trường GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET hoặc GOOGLE_REFRESH_TOKEN."
    );
  }
  return { clientId, clientSecret, refreshToken, calendarId };
}

// Tạo client Calendar đã xác thực, dùng chung cho việc tạo và xóa sự kiện
function getCalendarClient() {
  const { clientId, clientSecret, refreshToken, calendarId } = getConfig();
  const oauth2Client = new auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return { client: calendar({ version: "v3", auth: oauth2Client }), calendarId };
}

export interface GoogleMeetEvent {
  /** Link Google Meet */
  meetUrl: string;
  /** Mã sự kiện trên Google Calendar, dùng để xóa sự kiện khi hủy lịch */
  eventId: string;
}

/**
 * Tạo một sự kiện trên Google Calendar kèm phòng Google Meet, trả về link Meet và mã sự kiện.
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
): Promise<GoogleMeetEvent> {
  try {
    const { client, calendarId } = getCalendarClient();
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

    const eventId = res.data.id ?? null;

    if (!link || !eventId) {
      throw new Error(
        `Google Calendar đã tạo sự kiện (id: ${eventId ?? "?"}) nhưng không trả về ${link ? "mã sự kiện" : "link Google Meet"}.`
      );
    }
    return { meetUrl: link, eventId };
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

/**
 * Xóa một sự kiện trên Google Calendar (dùng khi hủy lịch họp ONLINE).
 * `sendUpdates: "all"` để Google gửi email báo hủy cho những người được mời (nếu có).
 * Sự kiện đã bị xóa từ trước (Google trả 404/410) được coi là thành công.
 * Ném lỗi trong các trường hợp khác để nơi gọi quyết định cách xử lý.
 */
export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  try {
    const { client, calendarId } = getCalendarClient();
    await client.events.delete(
      { calendarId, eventId, sendUpdates: "all" },
      { timeout: TIMEOUT_MS }
    );
  } catch (err) {
    const e = err as { code?: number | string; message?: string; errors?: unknown };
    const code = Number(e.code);
    if (code === 404 || code === 410) return; // sự kiện không còn trên lịch: coi như đã xóa

    console.error("[GoogleCalendar] Lỗi xóa sự kiện:", {
      eventId,
      code: e.code ?? null,
      message: e.message ?? String(err),
      details: e.errors ?? null,
    });
    throw err;
  }
}
