-- Adds the "Our Team" section. Safe to run even if you've already run
-- SUPABASE_SETUP.sql / UPDATE_phase2.sql before. (Brand-new projects: just
-- run the full SUPABASE_SETUP.sql — it already includes this.)

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

alter table team_members enable row level security;

drop policy if exists "public can read team_members" on team_members;
create policy "public can read team_members" on team_members for select using (true);
drop policy if exists "admins can write team_members" on team_members;
create policy "admins can write team_members" on team_members for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Team photos reuse the existing public "branding" storage bucket —
-- no new bucket needed, it's already public-read / admin-write.
