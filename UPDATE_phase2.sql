-- Phase 2 update: Next Event poster/venue/prize pool/registration status,
-- plus the new Brand Partners logo bar. Safe to run even if you already
-- ran SUPABASE_SETUP.sql before Phase 2 existed — every statement here is
-- idempotent. (If you're setting up a brand-new project instead, just run
-- the full SUPABASE_SETUP.sql — it already includes all of this.)

alter table site_settings add column if not exists next_event_poster_url text default '';
alter table site_settings add column if not exists next_event_venue text default '';
alter table site_settings add column if not exists next_event_prize_pool text default '';
alter table site_settings add column if not exists next_event_registration_status text default 'Open'
  check (next_event_registration_status in ('Open', 'Full', 'Closed'));
alter table site_settings add column if not exists stat_tournaments text default '';
alter table site_settings add column if not exists stat_prize_money text default '';
alter table site_settings add column if not exists stat_reach text default '';
alter table site_settings add column if not exists stat_players text default '';

create table if not exists brand_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null,
  website_url text,
  created_at timestamptz default now()
);

alter table brand_partners enable row level security;

drop policy if exists "public can read brand_partners" on brand_partners;
create policy "public can read brand_partners" on brand_partners for select using (true);
drop policy if exists "admins can write brand_partners" on brand_partners;
create policy "admins can write brand_partners" on brand_partners for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Partner logos reuse the existing public "branding" storage bucket —
-- no new bucket needed, it's already public-read / admin-write.
