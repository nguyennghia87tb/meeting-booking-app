import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client dùng service_role key: BỎ QUA RLS, chỉ được dùng ở phía server
 * (API route). Không import file này từ component "use client" và không đặt tên
 * biến môi trường bắt đầu bằng NEXT_PUBLIC_ (sẽ lộ key ra trình duyệt).
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
