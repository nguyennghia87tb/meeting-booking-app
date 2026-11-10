"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CancelButtonProps {
  bookingId: number;
}

/** Nút "Hủy" lịch họp: hỏi mật khẩu quản trị, gọi API, rồi tải lại danh sách. */
export default function CancelButton({ bookingId }: CancelButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (loading) return;
    // Bấm Cancel -> prompt trả về null -> không làm gì cả
    const password = prompt("Vui lòng nhập mật khẩu quản trị để hủy lịch:");
    if (password === null) return;

    setLoading(true);
    setError(null);
    try {
      // Mật khẩu gửi trong body (không đưa lên URL) và được kiểm tra ở máy chủ
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result: { message?: string; error?: string; promoted?: unknown; warnings?: string[] } =
        await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(result.error ?? "Hủy lịch không thành công, vui lòng thử lại.");
        return;
      }
      // Có người được đôn lên hoặc có cảnh báo thì báo rõ cho người dùng
      if (result.promoted || (result.warnings && result.warnings.length > 0)) {
        alert([result.message, ...(result.warnings ?? [])].filter(Boolean).join("\n"));
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-base font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-70 xl:min-h-9 xl:text-sm"
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"
          />
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        )}
        {loading ? "Đang hủy..." : "Hủy"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-base font-medium text-red-600 xl:text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
