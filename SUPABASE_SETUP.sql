-- ============================================================
-- RTB ESPORTS — full Supabase setup (public site + admin suite)
-- Run this ONCE in Supabase SQL Editor (Project → SQL Editor → New query)
-- Safe to re-run: every statement is idempotent (if not exists / or replace).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Admin membership (single private team — Admin-only write access)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text default 'admin' check (role in ('admin', 'member')),
  created_at timestamptz default now()
);

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PART A — PUBLIC SITE DATA (site_settings, youtube_videos, gallery_photos)
-- Readable by anyone (anon key, no login) so the public marketing site can
-- render them; writable only by admins (via the dashboard, logged in).
-- ============================================================

-- ------------------------------------------------------------
-- A1. SITE SETTINGS — single row (id = 1), upserted from the admin
--     dashboard's "Site Branding & Social" tab.
-- ------------------------------------------------------------
create table if not exists site_settings (
  id int primary key default 1,
  logo_url text default '',
  favicon_url text default '',
  hero_title text default 'WE RUN THE ARENA',
  hero_subtitle text default 'RTB Esports produces Bangladesh''s biggest Free Fire tournaments — official events, live broadcasts, and the players who show up to win.',
  announcement_bar text default '',
  next_event_name text default 'Free Fire Bangladesh Championship — Finals',
  next_event_starts_at timestamptz default (now() + interval '2 days'),
  facebook_url text default '',
  youtube_url text default '',
  instagram_url text default '',
  discord_url text default '',
  whatsapp_number text default '',
  contact_email text default '',
  contact_phone text default '',
  contact_address text default '',
  updated_at timestamptz default now(),
  constraint site_settings_single_row check (id = 1)
);

-- Defensive: if this table already existed from an earlier run of this
-- script (before a column below was added), "create table if not exists"
-- above would have silently skipped it. These make every column show up
-- regardless of when the table was first created.
alter table site_settings add column if not exists logo_url text default '';
alter table site_settings add column if not exists favicon_url text default '';
alter table site_settings add column if not exists hero_title text default 'WE RUN THE ARENA';
alter table site_settings add column if not exists hero_subtitle text default 'RTB Esports produces Bangladesh''s biggest Free Fire tournaments — official events, live broadcasts, and the players who show up to win.';
alter table site_settings add column if not exists announcement_bar text default '';
alter table site_settings add column if not exists next_event_name text default 'Free Fire Bangladesh Championship — Finals';
alter table site_settings add column if not exists next_event_starts_at timestamptz default (now() + interval '2 days');
alter table site_settings add column if not exists facebook_url text default '';
alter table site_settings add column if not exists youtube_url text default '';
alter table site_settings add column if not exists instagram_url text default '';
alter table site_settings add column if not exists discord_url text default '';
alter table site_settings add column if not exists whatsapp_number text default '';
alter table site_settings add column if not exists contact_email text default '';
alter table site_settings add column if not exists contact_phone text default '';
alter table site_settings add column if not exists contact_address text default '';
alter table site_settings add column if not exists updated_at timestamptz default now();
alter table site_settings add column if not exists next_event_poster_url text default '';
alter table site_settings add column if not exists next_event_venue text default '';
alter table site_settings add column if not exists next_event_prize_pool text default '';
alter table site_settings add column if not exists next_event_registration_status text default 'Open'
  check (next_event_registration_status in ('Open', 'Full', 'Closed'));
alter table site_settings add column if not exists stat_tournaments text default '';
alter table site_settings add column if not exists stat_prize_money text default '';
alter table site_settings add column if not exists stat_reach text default '';
alter table site_settings add column if not exists stat_players text default '';

insert into site_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- A2. YOUTUBE VIDEOS — Media Hub
-- ------------------------------------------------------------
create table if not exists youtube_videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null,
  title text not null default 'Untitled video',
  category text not null default 'Highlights',
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- A3. GALLERY PHOTOS — Web Gallery
-- ------------------------------------------------------------
create table if not exists gallery_photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  category text not null default 'Stage',
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- A3b. BRAND PARTNERS — logo bar on the public site
-- ------------------------------------------------------------
create table if not exists brand_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null,
  website_url text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- A3c. TEAM MEMBERS — "Our Team" section on the public site
-- ------------------------------------------------------------
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default '',
  photo_url text default '',
  instagram_url text default '',
  facebook_url text default '',
  phone text default '',
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- A4. RLS — public can READ, only admins can WRITE
-- ------------------------------------------------------------
alter table site_settings enable row level security;
alter table youtube_videos enable row level security;
alter table gallery_photos enable row level security;
alter table brand_partners enable row level security;

drop policy if exists "public can read site_settings" on site_settings;
create policy "public can read site_settings" on site_settings for select using (true);
drop policy if exists "admins can write site_settings" on site_settings;
create policy "admins can write site_settings" on site_settings for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "public can read youtube_videos" on youtube_videos;
create policy "public can read youtube_videos" on youtube_videos for select using (true);
drop policy if exists "admins can write youtube_videos" on youtube_videos;
create policy "admins can write youtube_videos" on youtube_videos for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "public can read gallery_photos" on gallery_photos;
create policy "public can read gallery_photos" on gallery_photos for select using (true);
drop policy if exists "admins can write gallery_photos" on gallery_photos;
create policy "admins can write gallery_photos" on gallery_photos for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "public can read brand_partners" on brand_partners;
create policy "public can read brand_partners" on brand_partners for select using (true);
drop policy if exists "admins can write brand_partners" on brand_partners;
create policy "admins can write brand_partners" on brand_partners for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

alter table team_members enable row level security;
drop policy if exists "public can read team_members" on team_members;
create policy "public can read team_members" on team_members for select using (true);
drop policy if exists "admins can write team_members" on team_members;
create policy "admins can write team_members" on team_members for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ------------------------------------------------------------
-- A5. STORAGE — public buckets for branding + gallery images
--     (public = true so <img src="..."> works directly, no signed URLs)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('branding', 'branding', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true) on conflict (id) do nothing;

drop policy if exists "public can view branding" on storage.objects;
create policy "public can view branding" on storage.objects for select using (bucket_id = 'branding');
drop policy if exists "admins can manage branding" on storage.objects;
create policy "admins can manage branding" on storage.objects for all using (
  bucket_id = 'branding' and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "public can view gallery" on storage.objects;
create policy "public can view gallery" on storage.objects for select using (bucket_id = 'gallery');
drop policy if exists "admins can manage gallery" on storage.objects;
create policy "admins can manage gallery" on storage.objects for all using (
  bucket_id = 'gallery' and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ============================================================
-- PART B — ACCOUNTING SUITE (Invoice Generator, Costing & Profit, PDF Studio)
-- Admin-only, everywhere — nothing here is public.
-- ============================================================

-- ------------------------------------------------------------
-- B1. INVOICES — Garena / client invoices. Subtotal / service charge /
--     grand total are STORED GENERATED COLUMNS so they can never drift
--     out of sync with the inputs.
-- ------------------------------------------------------------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  invoice_date date not null default current_date,

  project_name text not null,
  edition text,

  client_name text not null default 'Garena Online Private Limited',
  client_address text,

  prizepool_usd numeric(12,2) not null default 0,
  event_cost_usd numeric(12,2) not null default 0,
  service_charge_pct numeric(5,2) not null default 10,

  subtotal_usd numeric(12,2) generated always as (prizepool_usd + event_cost_usd) stored,
  service_charge_usd numeric(12,2) generated always as
    ((prizepool_usd + event_cost_usd) * service_charge_pct / 100) stored,
  grand_total_usd numeric(12,2) generated always as
    ((prizepool_usd + event_cost_usd) * (1 + service_charge_pct / 100)) stored,

  bank_name text default 'EASTERN BANK LIMITED',
  bank_acc_no text,
  bank_acc_name text,
  swift_code text,
  routing_number text,

  pdf_storage_path text, -- path inside the 'documents' bucket, e.g. Invoices/Invoice-RE1031.pdf

  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- B2. EVENT EXPENSES — internal costing per invoice/project
-- ------------------------------------------------------------
create table if not exists event_expenses (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  category text not null check (category in ('Venue', 'Production', 'Casting', 'Logistics', 'Local Costs', 'Other')),
  description text,
  amount_usd numeric(12,2) not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- B3. BANK REMITTANCES — USD -> BDT encashment tracking + slip upload
-- ------------------------------------------------------------
create table if not exists bank_remittances (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  usd_received numeric(12,2) not null,
  fx_rate numeric(10,4) not null,
  bdt_credited numeric(14,2) generated always as (usd_received * fx_rate) stored,
  remittance_date date not null default current_date,
  slip_storage_path text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- B4. PDF STUDIO — folders and files (actual bytes live in the private
--     'documents' storage bucket set up in section B6; this tracks metadata)
-- ------------------------------------------------------------
create table if not exists studio_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references studio_folders(id) on delete cascade,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists studio_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references studio_folders(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  notes jsonb not null default '[]'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- B5. Project financial summary view
--     Income = invoice Grand Total. Net Profit = Income − Internal Expenses.
-- ------------------------------------------------------------
drop view if exists project_financial_summary;
create view project_financial_summary as
select
  i.id as invoice_id,
  i.invoice_number,
  i.project_name,
  i.client_name,
  i.grand_total_usd as income_usd,
  coalesce(e.total_expense_usd, 0) as internal_expense_usd,
  i.grand_total_usd - coalesce(e.total_expense_usd, 0) as net_profit_usd,
  coalesce(r.total_bdt_credited, 0) as total_bdt_credited
from invoices i
left join (
  select invoice_id, sum(amount_usd) as total_expense_usd
  from event_expenses
  group by invoice_id
) e on e.invoice_id = i.id
left join (
  select invoice_id, sum(bdt_credited) as total_bdt_credited
  from bank_remittances
  group by invoice_id
) r on r.invoice_id = i.id;

-- ------------------------------------------------------------
-- B6. RLS — admin-only, everywhere in this section
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table invoices enable row level security;
alter table event_expenses enable row level security;
alter table bank_remittances enable row level security;
alter table studio_folders enable row level security;
alter table studio_files enable row level security;

drop policy if exists "admins can read own profile" on profiles;
create policy "admins can read own profile" on profiles for select using (auth.uid() = id);

drop policy if exists "admins full access invoices" on invoices;
create policy "admins full access invoices" on invoices for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "admins full access expenses" on event_expenses;
create policy "admins full access expenses" on event_expenses for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "admins full access remittances" on bank_remittances;
create policy "admins full access remittances" on bank_remittances for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "admins full access studio folders" on studio_folders;
create policy "admins full access studio folders" on studio_folders for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "admins full access studio files" on studio_files;
create policy "admins full access studio files" on studio_files for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ------------------------------------------------------------
-- B7. STORAGE — private 'documents' bucket (invoices, remittance slips,
--     event reports, custom PDFs) — admin-only, never public.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "admins can upload documents" on storage.objects;
create policy "admins can upload documents" on storage.objects for insert with check (
  bucket_id = 'documents' and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists "admins can read documents" on storage.objects;
create policy "admins can read documents" on storage.objects for select using (
  bucket_id = 'documents' and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists "admins can update documents" on storage.objects;
create policy "admins can update documents" on storage.objects for update using (
  bucket_id = 'documents' and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
drop policy if exists "admins can delete documents" on storage.objects;
create policy "admins can delete documents" on storage.objects for delete using (
  bucket_id = 'documents' and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ============================================================
-- Done. What the app does with this on first load:
--   - site_settings: the single row (id=1) is read as-is; edit it from
--     the "Site Branding & Social" admin tab (includes Next Event now).
--   - youtube_videos / gallery_photos: start empty — add your first
--     entries from the Media Hub / Web Gallery admin tabs.
--   - studio_folders: the four defaults (Invoices, Remittance Slips,
--     Event Reports, Custom PDFs) are created automatically the first
--     time the admin dashboard loads and finds none.
--
-- Only invite trusted admins: Supabase dashboard → Authentication →
-- Users → Invite user. There is no self-signup — every table and bucket
-- above is locked to role = 'admin' via RLS.
-- ============================================================
