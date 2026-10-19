-- 홍보잇다 — Supabase 설정 (한 번만 실행). Supabase 대시보드 → SQL Editor → 붙여 넣고 Run.
-- 내 홍보물: 기록 한 줄(records) + 파일(Storage 버킷 "records", 경로 <user id>/<record id>/<파일>).
-- 모든 표와 파일은 "본인 것만" 읽고 쓸 수 있다(row-level security). 다시 실행해도 안전하게 썼다.

create table if not exists public.records (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 기록 내용(입력, 홍보 글, 고른 채널 등). 사진·배경은 data에 넣지 않고 파일로 저장한다.
  data jsonb not null,
  photo_path text,
  scene_path text,
  poster_path text,
  video_path text
);

create index if not exists records_user_created on public.records (user_id, created_at desc);

alter table public.records enable row level security;

drop policy if exists "records: own rows" on public.records;
create policy "records: own rows" on public.records
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 파일 버킷: 공개 아님(링크는 짧게 유효한 서명 주소로만). 파일 하나 최대 50MB, 그림·영상만.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('records', 'records', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "records files: own folder" on storage.objects;
create policy "records files: own folder" on storage.objects
  for all
  using (bucket_id = 'records' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'records' and (storage.foldername(name))[1] = auth.uid()::text);
