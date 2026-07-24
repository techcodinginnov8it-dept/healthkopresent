import { createBrowserClient } from "@supabase/ssr";

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Prevent build-time static pre-rendering from crashing when variables are not yet defined.
    if (typeof window === "undefined") {
      return createBrowserClient(
        supabaseUrl || "https://placeholder.supabase.co",
        supabaseKey || "placeholder-key"
      );
    }
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Set these in your Vercel project environment variables."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
};
