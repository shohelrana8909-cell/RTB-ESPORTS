-- ============================================================
-- RTB Esports — Accounting & Invoice System
-- Full Supabase migration script
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- ------------------------------------------------------------
-- 0. Workspace membership (single private team — Admin-only access)
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

-- ------------------------------------------------------------
-- 1. INVOICES  (Garena / client invoices)
--    Subtotal / service charge / grand total are STORED GENERATED
--    COLUMNS so they can never drift out of sync with the inputs.
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
-- 2. EVENT EXPENSES  (internal costing per invoice/project)
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
-- 3. BANK REMITTANCES  (USD -> BDT encashment tracking + slip upload)
-- ------------------------------------------------------------
create table if not exists bank_remittances (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  usd_received numeric(12,2) not null,
  fx_rate numeric(10,4) not null,           -- BDT per USD, logged at the moment of encashment
  bdt_credited numeric(14,2) generated always as (usd_received * fx_rate) stored,
  remittance_date date not null default current_date,
  slip_storage_path text,                    -- path inside 'documents' bucket, e.g. Remittance Slips/xxx.pdf
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3b. PDF STUDIO — folders and files (persists what used to be
--     browser-only state; actual bytes live in the 'documents'
--     storage bucket set up in section 6, this just tracks metadata)
-- ------------------------------------------------------------
create table if not exists studio_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references studio_folders(id) on delete cascade, -- null = top-level ("All Files")
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists studio_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references studio_folders(id) on delete cascade, -- null = top-level
  name text not null,
  storage_path text not null, -- path inside the 'documents' bucket
  size_bytes bigint,
  notes jsonb not null default '[]'::jsonb, -- sticky-note annotations from the PDF editor
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. PROJECT FINANCIAL SUMMARY VIEW
--    Income = the invoice's Grand Total (Prizepool + Event Cost + Service
--    Charge) — the whole amount actually billed and collected from the
--    client. Net Profit = that Income − Internal Expenses (what RTB really
--    spends running the event, including paying out the prizepool).
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
-- 5. ROW LEVEL SECURITY  (Admin-only access — private system)
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table invoices enable row level security;
alter table event_expenses enable row level security;
alter table bank_remittances enable row level security;
alter table studio_folders enable row level security;
alter table studio_files enable row level security;

drop policy if exists "admins can read own profile" on profiles;
create policy "admins can read own profile" on profiles
  for select using (auth.uid() = id);

drop policy if exists "admins full access invoices" on invoices;
create policy "admins full access invoices" on invoices
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admins full access expenses" on event_expenses;
create policy "admins full access expenses" on event_expenses
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admins full access remittances" on bank_remittances;
create policy "admins full access remittances" on bank_remittances
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admins full access studio folders" on studio_folders;
create policy "admins full access studio folders" on studio_folders
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admins full access studio files" on studio_files;
create policy "admins full access studio files" on studio_files
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Note: project_financial_summary is a plain view, so it inherits RLS
-- from the underlying tables automatically (Postgres security_invoker
-- behaviour) — no separate policy needed.

-- ------------------------------------------------------------
-- 6. STORAGE — one 'documents' bucket, folder-per-purpose paths
--    (Invoices/, Remittance Slips/, Event Reports/, Custom PDFs/)
-- ------------------------------------------------------------
-- Run this part from the Supabase dashboard (Storage → New bucket)
-- or via the SQL below if you prefer doing it all in one place:

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "admins can upload documents" on storage.objects;
create policy "admins can upload documents" on storage.objects
  for insert
  with check (
    bucket_id = 'documents'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admins can read documents" on storage.objects;
create policy "admins can read documents" on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admins can update documents" on storage.objects;
create policy "admins can update documents" on storage.objects
  for update
  using (
    bucket_id = 'documents'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admins can delete documents" on storage.objects;
create policy "admins can delete documents" on storage.objects
  for delete
  using (
    bucket_id = 'documents'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Object paths in use (by convention in the app's upload code, not
-- enforced by Postgres): 'Invoices/<uid>-Invoice-RE1031.pdf',
-- 'Remittance Slips/<uid>-slip.pdf', 'Event Reports/...', or the
-- folder's real id for anything uploaded directly in PDF Studio.

-- ============================================================
-- Frontend wiring — done
-- ============================================================
-- The app (src/App.jsx) reads/writes all of this for real:
--   - invoices, event_expenses, bank_remittances — CRUD on save/add/remove
--   - studio_folders, studio_files — CRUD for PDF Studio, with the actual
--     bytes uploaded to/fetched from the 'documents' bucket via signed URLs
-- On a brand-new Supabase project, the four default PDF Studio folders
-- (Invoices, Remittance Slips, Event Reports, Custom PDFs) are created
-- automatically the first time the app loads and finds none.
--
-- Only invite trusted admins via Authentication → Users → Invite — every
-- table and the storage bucket are locked to role = 'admin'.
