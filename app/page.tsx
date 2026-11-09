import { Suspense } from "react";
import { connection } from "next/server";
import BookingForm from "@/components/BookingForm";
import BookingList from "@/components/BookingList";
import {
  getBookingsByDate,
  getDepartments,
  getMeetingRooms,
} from "@/lib/supabase/queries";

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD
// (toISOString() trả về giờ UTC nên sẽ lệch ngày trong khoảng 00:00-07:00 sáng)
function todayInVietnam(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

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
async function loadData(today: string) {
  try {
    const [departments, rooms, bookings] = await Promise.all([
      getDepartments(),
      getMeetingRooms(),
      getBookingsByDate(today),
    ]);
    return { departments, rooms, bookings, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Lỗi không xác định";
    return { departments: [], rooms: [], bookings: [], error };
  }
}

async function HomeContent() {
  // Dữ liệu lấy lúc có request, không prerender lúc build
  await connection();
  const today = todayInVietnam();
  const { departments, rooms, bookings, error } = await loadData(today);

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

  const [y, m, d] = today.split("-");
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-5">
        <BookingForm departments={departments} rooms={rooms} />
      </div>
      <div className="min-w-0 lg:col-span-7">
        <BookingList bookings={bookings} departments={departments} dateLabel={`${d}/${m}/${y}`} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 flex items-center gap-3 border-b-4 border-brand pb-3 sm:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo.jpg" alt="VIET XO Steel" className="h-16 w-auto sm:h-20" />
          <div>
            <h1 className="text-2xl font-bold text-brand-dark sm:text-3xl">Đăng ký phòng họp</h1>
            <p className="mt-1 text-base text-slate-600">VX Thanh Hóa</p>
          </div>
        </header>
        <Suspense fallback={<LoadingState />}>
          <HomeContent />
        </Suspense>
      </div>
    </main>
  );
}
