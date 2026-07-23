import { createClient } from "@supabase/supabase-js";

// These come from your .env.local (local dev) or your Vercel project's
// Environment Variables (production) — see .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Don't throw — let the app render a clear error screen instead of a blank page.
  console.error(
    "Missing Supabase env vars. Create a .env.local with VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY (see .env.example), or set them in your Vercel project settings."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
