import CancelButton from "@/components/CancelButton";
import type { Booking, BookingStatus, Department, MeetingType } from "@/types/database";

interface BookingListProps {
  bookings: Booking[];
  departments: Department[];
  /** Thời điểm hiện tại (mili giây), dùng để nhận biết cuộc họp đã kết thúc */
  now: number;
}

// Ngày theo giờ Việt Nam, dạng dd/mm/yyyy
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

function dateOf(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Ho_Chi_Minh",
});

// Giờ, ví dụ: "08:00 - 10:00"
function hoursOf(b: Booking): string {
  return `${timeFormatter.format(new Date(b.start_time))} - ${timeFormatter.format(new Date(b.end_time))}`;
}

// Ngày, ví dụ: "10/11/2026". Cuộc họp kéo sang ngày khác thì ghi cả ngày kết thúc.
function dayOf(b: Booking): string {
  const startDate = dateOf(b.start_time);
  const endDate = dateOf(b.end_time);
  return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
}

const STATUS_STYLE: Record<BookingStatus, { label: string; className: string }> = {
  CONFIRMED: { label: "Đã xác nhận", className: "bg-green-100 text-green-800" },
  WAITING: { label: "Chờ", className: "bg-yellow-100 text-yellow-800" },
  CANCELLED: { label: "Đã hủy", className: "bg-red-100 text-red-700" },
};

const TYPE_LABEL: Record<MeetingType, string> = {
  OFFLINE: "Trực tiếp",
  ONLINE: "Trực tuyến",
};

// Chỉ lịch đang CONFIRMED hoặc WAITING mới hủy được
function canCancel(b: Booking): boolean {
  return b.status === "CONFIRMED" || b.status === "WAITING";
}

// Nhãn cho cuộc họp đã qua giờ kết thúc (chỉ là cách hiển thị, trạng thái trong DB không đổi)
const ENDED_STYLE = { label: "Đã kết thúc", className: "bg-slate-200 text-slate-600" };

function StatusBadge({ status, ended }: { status: BookingStatus; ended: boolean }) {
  const s = ended ? ENDED_STYLE : STATUS_STYLE[status];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium xl:px-2.5 xl:text-xs ${s.className}`}
    >
      {s.label}
    </span>
  );
}

function MeetLink({ url }: { url: string | null }) {
  // Chỉ hiển thị link https để tránh các scheme lạ
  if (!url || !url.startsWith("https://")) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex min-h-11 items-center whitespace-nowrap rounded-lg bg-brand-dark px-4 py-2 text-base font-medium text-white hover:bg-brand xl:mt-1.5 xl:min-h-8 xl:px-3 xl:py-1 xl:text-xs"
    >
      Tham gia Google Meet
    </a>
  );
}

export default function BookingList({ bookings, departments, now }: BookingListProps) {
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const nameOf = (b: Booking) => deptName.get(b.department_id) ?? "—";

  // "Đã kết thúc" = đã qua giờ kết thúc và chưa bị hủy. Cuộc họp đang diễn ra hoặc sắp tới
  // không bị ảnh hưởng. Mốc "bây giờ" (now) do trang truyền vào, lấy lúc máy chủ tải dữ liệu.
  // Đã qua giờ kết thúc, bất kể trạng thái
  const isPast = (b: Booking) => new Date(b.end_time).getTime() < now;
  // Nhãn "Đã kết thúc" chỉ dùng cho lịch chưa bị hủy; lịch đã hủy vẫn giữ nhãn "Đã hủy" màu đỏ
  const isEnded = (b: Booking) => b.status !== "CANCELLED" && isPast(b);
  // Còn hiệu lực: chưa hủy và chưa kết thúc. Chỉ khi đó mới hiện nút "Hủy" và nút tham gia Meet.
  const isActive = (b: Booking) => canCancel(b) && !isEnded(b);
  // Làm mờ cả dòng của mọi lịch đã qua giờ kết thúc, kể cả lịch đã hủy
  const dim = (b: Booking) => (isPast(b) ? "opacity-50" : "");

  return (
    // lg+: khung cao bằng cột (h-full), tiêu đề đứng yên, chỉ phần danh sách bên dưới cuộn
    <section className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:p-4">
      <h2 className="shrink-0 text-xl font-semibold text-slate-900 lg:text-lg">Danh sách lịch họp</h2>

      {bookings.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-6 text-center text-base text-slate-600">
          Chưa có cuộc họp nào được đăng ký.
        </p>
      ) : (
        <>
          {/* Điện thoại: dạng thẻ */}
          <ul className="mt-4 max-h-[600px] space-y-3 overflow-y-auto lg:mt-3 lg:max-h-none lg:min-h-0 lg:flex-1 xl:hidden">
            {bookings.map((b) => (
              <li
                key={b.id}
                className={`min-w-0 rounded-xl [overflow-wrap:anywhere] border border-slate-200 p-4 ${dim(b)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="whitespace-nowrap text-base font-semibold text-slate-900">
                      {hoursOf(b)}
                    </div>
                    <div className="text-sm text-slate-500">{dayOf(b)}</div>
                  </div>
                  <StatusBadge status={b.status} ended={isEnded(b)} />
                </div>
                <p className="mt-1 text-base font-medium text-slate-900">{b.meeting_title}</p>
                <p className="text-base text-slate-600">
                  {b.full_name} · {nameOf(b)}
                </p>
                <p className="text-base text-slate-600">{TYPE_LABEL[b.meeting_type]}</p>
                {/* Lịch đã hủy hoặc đã kết thúc thì không hiện nút tham gia Meet và nút Hủy nữa */}
                {isActive(b) && <MeetLink url={b.meet_url} />}
                {isActive(b) && <CancelButton bookingId={b.id} />}
              </li>
            ))}
          </ul>

          {/* Màn hình rộng: dạng bảng */}
          {/* Cuộn dọc và ngang trong cùng một khung thì tiêu đề bảng mới dính được khi cuộn */}
          <div className="mt-3 hidden w-full overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 xl:block xl:min-h-0 xl:flex-1">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-600 shadow-[0_1px_0_0_#cbd5e1]">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Thời gian</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Tiêu đề</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Người đăng ký</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">Hình thức</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">Trạng thái</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    className={`align-middle odd:bg-white even:bg-slate-50/60 hover:bg-brand-light/50 ${dim(b)}`}
                  >
                    {/* Thời gian: dòng 1 giờ (đậm), dòng 2 ngày (nhỏ, xám) */}
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="font-semibold text-slate-900">{hoursOf(b)}</div>
                      <div className="text-xs text-slate-500">{dayOf(b)}</div>
                    </td>
                    {/* Tiêu đề: không hẹp hơn 11rem để chữ không rớt dòng lắt nhắt */}
                    <td className="min-w-[11rem] px-3 py-3 [overflow-wrap:anywhere]">
                      <div className="font-medium text-slate-900">{b.meeting_title}</div>
                      {isActive(b) && <MeetLink url={b.meet_url} />}
                    </td>
                    {/* Người đăng ký: dòng 1 tên, dòng 2 phòng ban (nhỏ, xám) */}
                    <td className="min-w-[9rem] px-3 py-3">
                      <div>{b.full_name}</div>
                      <div className="text-xs text-slate-500">{nameOf(b)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center">
                      {TYPE_LABEL[b.meeting_type]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center">
                      <StatusBadge status={b.status} ended={isEnded(b)} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center">
                      {isActive(b) ? <CancelButton bookingId={b.id} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
