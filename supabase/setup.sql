-- 在 Supabase 的 SQL Editor 里整段执行一次即可。
-- 作用：建一张只存一行数据的表（整站内容）、一个 photos 存储桶，并允许匿名读写。

-- 1) 整站内容的表
create table if not exists public.site (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site enable row level security;

-- 允许匿名读取和写入（这是个人情侣站，前端用的是公开的 anon key）
drop policy if exists "site read" on public.site;
create policy "site read" on public.site for select using (true);

drop policy if exists "site insert" on public.site;
create policy "site insert" on public.site for insert with check (true);

drop policy if exists "site update" on public.site;
create policy "site update" on public.site for update using (true);

-- 2) 照片存储桶
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "photos write" on storage.objects;
create policy "photos write" on storage.objects
  for insert with check (bucket_id = 'photos');

drop policy if exists "photos update" on storage.objects;
create policy "photos update" on storage.objects
  for update using (bucket_id = 'photos');
