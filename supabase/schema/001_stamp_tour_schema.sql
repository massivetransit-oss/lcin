create extension if not exists "pgcrypto";

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin text not null,
  created_at timestamptz not null default now()
);

create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  address text not null default '',
  lat double precision not null,
  lng double precision not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  photo_url text not null,
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

alter table users enable row level security;
alter table places enable row level security;
alter table visits enable row level security;

-- No Supabase Auth in this app: policies are intentionally open to anon.
-- This exposes users.pin to anyone with the anon key, which was accepted
-- as a trade-off for this casual, low-stakes service (see design spec).
create policy "public read users" on users for select using (true);
create policy "public insert users" on users for insert with check (true);

create policy "public read places" on places for select using (true);

create policy "public read visits" on visits for select using (true);
create policy "public insert visits" on visits for insert with check (true);

insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', true)
on conflict (id) do nothing;

create policy "public read visit photos" on storage.objects for select
  using (bucket_id = 'visit-photos');

create policy "public upload visit photos" on storage.objects for insert
  with check (bucket_id = 'visit-photos');
