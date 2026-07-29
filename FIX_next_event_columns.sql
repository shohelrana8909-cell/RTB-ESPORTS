-- One-time fix: adds the Next Event columns to an existing site_settings
-- table that was created before they were added to SUPABASE_SETUP.sql.
-- Safe to run even if the columns already exist.

alter table site_settings add column if not exists next_event_name text
  default 'Free Fire Bangladesh Championship — Finals';

alter table site_settings add column if not exists next_event_starts_at timestamptz
  default (now() + interval '2 days');

-- Make sure your existing row (id = 1) actually has values, not nulls:
update site_settings
set
  next_event_name = coalesce(next_event_name, 'Free Fire Bangladesh Championship — Finals'),
  next_event_starts_at = coalesce(next_event_starts_at, now() + interval '2 days')
where id = 1;
