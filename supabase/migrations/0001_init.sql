create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text,
  business_name text,
  owner_name text,
  email text not null,
  phone text,
  website text,
  logo_url text,
  mockup_url text,
  city text,
  state text,
  niche text,
  source text default 'website_lead_form',
  status text default 'new',
  notes text,
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  closed_at timestamptz,
  deal_value numeric,
  created_at timestamptz default now()
);

alter table prospects enable row level security;

-- Allow the server (with secret key) to insert. No public read/write.
create policy "service can insert" on prospects
  for insert
  to service_role
  with check (true);

create policy "service can read" on prospects
  for select
  to service_role
  using (true);
