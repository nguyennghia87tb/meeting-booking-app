import { randomUUID } from "node:crypto";
// Chỉ nạp phần Calendar của googleapis (thay vì cả thư viện) để gói deploy nhẹ hơn.
import { auth, calendar } from "googleapis/build/src/apis/calendar";

// CHỈ dùng ở server (API route). Không import file này vào component phía client.

const TIME_ZONE = "Asia/Ho_Chi_Minh";
// Giới hạn thời gian chờ Google để API đăng ký không bị treo
const TIMEOUT_MS = 8000;

function getConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  // Khi dán private key vào biến môi trường, dấu xuống dòng thường bị thành chuỗi "\n"
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey || !calendarId) {
    throw new Error(
      "Thiếu biến môi trường GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY hoặc GOOGLE_CALENDAR_ID."
    );
  }
  return { clientEmail, privateKey, calendarId };
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
    const { clientEmail, privateKey, calendarId } = getConfig();

    const jwt = new auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
      // Tùy chọn (chỉ với Google Workspace có ủy quyền toàn miền): tạo sự kiện thay mặt người dùng này
      subject: process.env.GOOGLE_IMPERSONATE_EMAIL || undefined,
    });

    const client = calendar({ version: "v3", auth: jwt });
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
    // Ghi log rõ nguyên nhân (KHÔNG in private key) rồi ném tiếp để nơi gọi quyết định cách xử lý
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
