import { Suspense } from "react";
import { connection } from "next/server";
import BookingForm from "@/components/BookingForm";
import BookingList from "@/components/BookingList";
import {
  getAllBookings,
  getDepartments,
  getMeetingRooms,
} from "@/lib/supabase/queries";

// Hiển thị trong lúc chờ tải dữ liệu từ Supabase
function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-base text-slate-600 shadow-sm"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      Đang tải dữ liệu...
    </div>
  );
}

// Lấy dữ liệu, trả về lỗi dạng chuỗi thay vì ném ra (để dựng JSX ngoài try/catch)
async function loadData() {
  try {
    const [departments, rooms, bookings] = await Promise.all([
      getDepartments(),
      getMeetingRooms(),
      getAllBookings(),
    ]);
    // now: mốc thời gian lúc tải dữ liệu, để danh sách biết cuộc họp nào đã kết thúc
    return { departments, rooms, bookings, now: Date.now(), error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Lỗi không xác định";
    return { departments: [], rooms: [], bookings: [], now: 0, error };
  }
}

async function HomeContent() {
  // Dữ liệu lấy lúc có request, không prerender lúc build
  await connection();
  const { departments, rooms, bookings, now, error } = await loadData();

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-base text-red-600">
        <p className="font-semibold">Không tải được dữ liệu.</p>
        <p className="mt-1">{error}</p>
        <p className="mt-2">
          Kiểm tra file .env.local và đã chạy supabase_schema.sql, seed.sql, grants.sql trên Supabase chưa.
        </p>
      </div>
    );
  }

  return (
    // Màn hình rộng (lg+): hai cột cao bằng phần còn lại của màn hình, mỗi cột tự cuộn bên trong.
    // Điện thoại: xếp dọc và cuộn cả trang như bình thường.
    <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:grid-rows-1 lg:gap-4">
      <div className="min-w-0 lg:col-span-4 lg:h-full lg:min-h-0">
        <BookingForm departments={departments} rooms={rooms} />
      </div>
      <div className="min-w-0 lg:col-span-8 lg:h-full lg:min-h-0">
        <BookingList bookings={bookings} departments={departments} now={now} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    // lg+: khóa chiều cao đúng bằng màn hình (h-screen) và chặn cuộn toàn trang
    <main className="min-h-screen w-full bg-slate-50 text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-4 sm:px-6 sm:py-8 lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:px-8 lg:py-3">
        <header className="mb-6 flex shrink-0 items-center gap-3 border-b-4 border-brand pb-3 sm:gap-4 lg:mb-3 lg:pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo.jpg" alt="VIET XO Steel" className="h-16 w-auto sm:h-20 lg:h-12" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight text-brand-dark sm:text-3xl lg:text-xl">
              ĐĂNG KÝ PHÒNG HỌP
            </h1>
            <p className="mt-0.5 text-lg font-semibold leading-snug text-brand lg:mt-0 lg:text-base">
              Công ty Cổ phần Thép Việt Xô
            </p>
            {/* Giá trị cốt lõi: chữ nhỏ, màu nhẹ để không làm Header cao thêm nhiều */}
            <p className="text-xs leading-snug text-brand-dark/80">
              Chính trực - Cam kết - Tận tâm - Gắn kết - Tôn trọng - Tuân thủ - Đổi mới - Sáng tạo
            </p>
          </div>
        </header>
        <Suspense fallback={<LoadingState />}>
          <HomeContent />
        </Suspense>
      </div>
    </main>
  );
}
