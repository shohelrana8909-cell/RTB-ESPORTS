import { createClient } from "@supabase/supabase-js";

// These come from your .env.local (local dev) or your Vercel project's
// Environment Variables (production) — see .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Don't throw — let the app render a clear error/fallback instead of a blank page.
  console.error(
    "Missing Supabase env vars. Create a .env.local with VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY (see .env.example), or set them in your Vercel project settings. " +
      "Run SUPABASE_SETUP.sql in your Supabase SQL Editor first if you haven't yet."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

// ---------------------------------------------------------------------------
// Everything this client talks to lives in ONE script: SUPABASE_SETUP.sql
// at the project root. Run it once in Supabase → SQL Editor and every table,
// RLS policy, and storage bucket below is created:
//
//   site_settings, youtube_videos, gallery_photos   (public site data)
//     — read by src/context/SiteDataContext.jsx, written by the
//       "Site Branding & Social" / "Media Hub" / "Web Gallery" admin tabs
//
//   invoices, event_expenses, bank_remittances       (accounting)
//   studio_folders, studio_files                     (PDF Studio)
//     — read/written by src/admin/accounting/useAccountingData.js and the
//       "Invoice Generator" / "Budget & Profit" / "PDF Management" admin tabs
//
//   storage buckets: branding (public), gallery (public), documents (private)
//
// To create your first admin: Supabase dashboard → Authentication → Users →
// Invite user. There's no self-signup — only invited users can log in at
// the admin route, and Row Level Security rejects writes from anyone whose
// profiles.role isn't 'admin', regardless of what the client sends.
// ---------------------------------------------------------------------------
