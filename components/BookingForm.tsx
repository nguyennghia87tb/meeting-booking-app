"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  Booking,
  Department,
  MeetingRoom,
  MeetingType,
  NewBooking,
} from "@/types/database";

interface BookingFormProps {
  departments: Department[];
  rooms: MeetingRoom[];
}

type FieldErrors = Partial<
  Record<"fullName" | "department" | "title" | "start" | "end" | "room", string>
>;

// Chuyển giá trị datetime-local (giờ Việt Nam) sang chuỗi ISO UTC
function toIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export default function BookingForm({ departments, rooms }: BookingFormProps) {
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("OFFLINE");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // Nghiệp vụ VXTH: chỉ có 1 phòng họp duy nhất
  const room = rooms[0] ?? null;

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!fullName.trim()) e.fullName = "Vui lòng nhập họ và tên.";
    if (!departmentId) e.department = "Vui lòng chọn phòng ban.";
    if (!title.trim()) e.title = "Vui lòng nhập tiêu đề cuộc họp.";
    if (!start) e.start = "Vui lòng chọn thời gian bắt đầu.";
    if (!end) e.end = "Vui lòng chọn thời gian kết thúc.";
    if (start && end && new Date(`${end}:00+07:00`) <= new Date(`${start}:00+07:00`)) {
      e.end = "Thời gian kết thúc phải sau thời gian bắt đầu.";
    }
    if (meetingType === "OFFLINE" && !room) {
      e.room = "Chưa có phòng họp trong hệ thống để gán cho cuộc họp trực tiếp.";
    }
    return e;
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setNotice(null);
    setServerError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload: NewBooking = {
      full_name: fullName.trim(),
      department_id: Number(departmentId),
      room_id: meetingType === "OFFLINE" ? room!.id : null,
      meeting_type: meetingType,
      meeting_title: title.trim(),
      start_time: toIso(start),
      end_time: toIso(end),
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: { booking?: Booking; error?: string; warning?: string | null } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || !result.booking) {
        setServerError(result.error ?? "Đăng ký không thành công, vui lòng thử lại.");
        return;
      }

      // Thành công: báo kết quả, xóa form và tải lại danh sách lịch họp
      const b = result.booking;
      setNotice(
        b.status === "WAITING"
          ? `Đăng ký thành công! Khung giờ này đã có người đặt, bạn đang ở vị trí chờ số ${b.queue_position}.`
          : "Đăng ký thành công!"
      );
      // Ví dụ: đã lưu đăng ký nhưng chưa tạo được link Google Meet
      if (result.warning) setServerError(result.warning);
      setFullName("");
      setDepartmentId("");
      setMeetingType("OFFLINE");
      setTitle("");
      setStart("");
      setEnd("");
      setErrors({});
      router.refresh();
    } catch {
      setServerError("Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-xl font-semibold text-slate-900">Đăng ký họp</h2>

      <div>
        <label htmlFor="fullName" className="mb-1 block text-base font-medium text-slate-700">
          Họ và tên <span className="text-red-600">*</span>
        </label>
        <input
          id="fullName"
          className={inputClass}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nguyễn Văn A"
        />
        {errors.fullName && <p className="mt-1 text-base text-red-600">{errors.fullName}</p>}
      </div>

      <div>
        <label htmlFor="department" className="mb-1 block text-base font-medium text-slate-700">
          Phòng ban <span className="text-red-600">*</span>
        </label>
        <select
          id="department"
          className={inputClass}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">-- Chọn phòng ban --</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {errors.department && <p className="mt-1 text-base text-red-600">{errors.department}</p>}
      </div>

      <fieldset>
        <legend className="mb-1 block text-base font-medium text-slate-700">Loại cuộc họp</legend>
        <div className="flex flex-wrap gap-3">
          {(["OFFLINE", "ONLINE"] as const).map((type) => (
            <label
              key={type}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-base ${
                meetingType === type
                  ? "border-brand bg-brand-light text-slate-900"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              <input
                type="radio" className="h-5 w-5 accent-brand-dark"
                name="meetingType"
                value={type}
                checked={meetingType === type}
                onChange={() => setMeetingType(type)}
              />
              {type === "OFFLINE" ? "Trực tiếp (OFFLINE)" : "Trực tuyến (ONLINE)"}
            </label>
          ))}
        </div>
        <p className="mt-1 text-base text-slate-600">
          {meetingType === "OFFLINE"
            ? room
              ? `Phòng họp sẽ được gán tự động: ${room.name}`
              : "Chưa có phòng họp nào trong hệ thống."
            : "Link Google Meet sẽ được tạo sau khi đăng ký."}
        </p>
        {errors.room && <p className="mt-1 text-base text-red-600">{errors.room}</p>}
      </fieldset>

      <div>
        <label htmlFor="title" className="mb-1 block text-base font-medium text-slate-700">
          Tiêu đề cuộc họp <span className="text-red-600">*</span>
        </label>
        <input
          id="title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Họp giao ban tuần"
        />
        {errors.title && <p className="mt-1 text-base text-red-600">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div className="min-w-0">
          <label htmlFor="start" className="mb-1 block text-base font-medium text-slate-700">
            Bắt đầu <span className="text-red-600">*</span>
          </label>
          <input
            id="start"
            type="datetime-local"
            className={inputClass}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          {errors.start && <p className="mt-1 text-base text-red-600">{errors.start}</p>}
        </div>
        <div className="min-w-0">
          <label htmlFor="end" className="mb-1 block text-base font-medium text-slate-700">
            Kết thúc <span className="text-red-600">*</span>
          </label>
          <input
            id="end"
            type="datetime-local"
            className={inputClass}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
          {errors.end && <p className="mt-1 text-base text-red-600">{errors.end}</p>}
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <p className="text-base font-medium text-red-600">
          Vui lòng kiểm tra lại các trường được đánh dấu ở trên.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-brand-light px-3 py-2 text-base font-medium text-slate-900"
        >
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-dark px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting && (
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
          />
        )}
        {submitting ? "Đang gửi..." : "Đăng ký họp"}
      </button>
      {serverError && (
        <p role="alert" className="text-base font-medium text-red-600">
          {serverError}
        </p>
      )}
    </form>
  );
}
