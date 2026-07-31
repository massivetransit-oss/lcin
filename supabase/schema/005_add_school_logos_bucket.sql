-- Public bucket for per-school CI/logo images, referenced by places.logo_url.
-- Files are uploaded manually (or via a one-off script) as each school's
-- real emblem is sourced; see docs/superpowers for the process used.
insert into storage.buckets (id, name, public)
values ('school-logos', 'school-logos', true)
on conflict (id) do nothing;

create policy "public read school logos" on storage.objects for select
  using (bucket_id = 'school-logos');

create policy "public upload school logos" on storage.objects for insert
  with check (bucket_id = 'school-logos');
