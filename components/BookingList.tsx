import CancelButton from "@/components/CancelButton";
import type { Booking, BookingStatus, Department, MeetingType } from "@/types/database";

interface BookingListProps {
  bookings: Booking[];
  departments: Department[];
  /** Nhãn ngày hiển thị trên tiêu đề, ví dụ "09/11/2026" */
  dateLabel: string;
}

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Ho_Chi_Minh",
});

function timeRange(b: Booking): string {
  return `${timeFormatter.format(new Date(b.start_time))} - ${timeFormatter.format(new Date(b.end_time))}`;
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

function StatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${s.className}`}>
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
      className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-brand-dark px-4 py-2 text-base font-medium text-white hover:bg-brand xl:min-h-9 xl:text-sm"
    >
      Tham gia Google Meet
    </a>
  );
}

export default function BookingList({ bookings, departments, dateLabel }: BookingListProps) {
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const nameOf = (b: Booking) => deptName.get(b.department_id) ?? "—";

  return (
    <section className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold text-slate-900">
        Lịch họp hôm nay <span className="font-normal text-slate-500">({dateLabel})</span>
      </h2>

      {bookings.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-6 text-center text-base text-slate-600">
          Hôm nay chưa có cuộc họp nào được đăng ký.
        </p>
      ) : (
        <>
          {/* Điện thoại: dạng thẻ */}
          <ul className="mt-4 space-y-3 xl:hidden">
            {bookings.map((b) => (
              <li key={b.id} className="min-w-0 rounded-xl [overflow-wrap:anywhere] border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-base font-semibold text-slate-900">{timeRange(b)}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-1 text-base font-medium text-slate-900">{b.meeting_title}</p>
                <p className="text-base text-slate-600">
                  {b.full_name} · {nameOf(b)}
                </p>
                <p className="text-base text-slate-600">{TYPE_LABEL[b.meeting_type]}</p>
                <MeetLink url={b.meet_url} />
                {canCancel(b) && <CancelButton bookingId={b.id} />}
              </li>
            ))}
          </ul>

          {/* Màn hình rộng: dạng bảng */}
          <div className="mt-4 hidden w-full overflow-x-auto xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Thời gian</th>
                  <th className="py-2 pr-3 font-medium">Tiêu đề</th>
                  <th className="py-2 pr-3 font-medium">Người đăng ký</th>
                  <th className="py-2 pr-3 font-medium">Hình thức</th>
                  <th className="py-2 pr-3 font-medium">Trạng thái</th>
                  <th className="py-2 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {bookings.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="whitespace-nowrap py-3 pr-3 font-medium">{timeRange(b)}</td>
                    <td className="min-w-[10rem] py-3 pr-3 [overflow-wrap:anywhere]">
                      {b.meeting_title}
                      <div>
                        <MeetLink url={b.meet_url} />
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      {b.full_name}
                      <div className="text-xs text-slate-500">{nameOf(b)}</div>
                    </td>
                    <td className="py-3 pr-3">{TYPE_LABEL[b.meeting_type]}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-3">{canCancel(b) ? <CancelButton bookingId={b.id} /> : null}</td>
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
