-- Cloud sync foundation for Chunk Diary.
-- Enable Supabase Auth anonymous sign-ins in Dashboard before using guest mode.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
alter table public.user_progress enable row level security;
alter table public.sync_snapshots enable row level security;

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings"
on public.user_settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own progress" on public.user_progress;
create policy "Users manage own progress"
on public.user_progress
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own sync snapshot" on public.sync_snapshots;
create policy "Users manage own sync snapshot"
on public.sync_snapshots
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists user_progress_user_id_updated_at_idx
on public.user_progress (user_id, updated_at desc);

create table if not exists public.generated_chunk_corpus (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generated_chunk_corpus enable row level security;

drop policy if exists "Users insert own generated chunk corpus" on public.generated_chunk_corpus;
create policy "Users insert own generated chunk corpus"
on public.generated_chunk_corpus
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users view own generated chunk corpus" on public.generated_chunk_corpus;
create policy "Users view own generated chunk corpus"
on public.generated_chunk_corpus
for select
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists generated_chunk_corpus_user_id_created_at_idx
on public.generated_chunk_corpus (user_id, created_at desc);
