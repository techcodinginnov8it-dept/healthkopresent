/**
 * src/utils/supabase/admin.ts
 *
 * SERVER-ONLY Supabase client using the service_role key.
 * This bypasses Row Level Security (RLS) entirely.
 *
 * ⚠️  NEVER import this in client components or expose to the browser.
 *     Only use inside server actions, API routes, or middleware.
 */
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
