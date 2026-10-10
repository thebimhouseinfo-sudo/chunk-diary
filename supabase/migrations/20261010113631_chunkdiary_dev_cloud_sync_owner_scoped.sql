-- ChunkDiary development database, versioned schema baseline.
-- Existing beta user data remains ONLY in browser; this creates empty cloud tables.
-- Explicit BACKUP_SYNC consent is mandatory before client writes. No auto-upload.
-- This file replaces the old unshipped global text-id schema for the new dedicated project.
--
-- Same local record IDs must coexist across different authenticated users.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint user_progress_id_nonempty check (length(id) between 1 and 255)
);

create table if not exists public.sync_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_chunk_corpus (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint corpus_id_nonempty check (length(id) between 1 and 255)
);

create index if not exists user_progress_owner_updated_idx
  on public.user_progress (user_id, updated_at desc);
create index if not exists corpus_owner_created_idx
  on public.generated_chunk_corpus (user_id, created_at desc);

-- Authenticated user only. Client must supply user_id derived from a verified
-- Supabase Auth session; RLS rejects attempts to write as another account.
alter table public.user_settings enable row level security;
alter table public.user_progress enable row level security;
alter table public.sync_snapshots enable row level security;
alter table public.generated_chunk_corpus enable row level security;

-- Protect also against accidental auth role exposure from default table grants.
revoke all on public.user_settings, public.user_progress,
  public.sync_snapshots, public.generated_chunk_corpus from anon;
grant select, insert, update, delete on public.user_settings,
  public.user_progress, public.sync_snapshots,
  public.generated_chunk_corpus to authenticated;

drop policy if exists "settings_owner" on public.user_settings;
create policy "settings_owner" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "progress_owner" on public.user_progress;
create policy "progress_owner" on public.user_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "snapshot_owner" on public.sync_snapshots;
create policy "snapshot_owner" on public.sync_snapshots
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "corpus_owner" on public.generated_chunk_corpus;
create policy "corpus_owner" on public.generated_chunk_corpus
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No explicit CORPUS_SHARE opt-in in this SQL: it only stores a user's
-- own corpus privately. Public sharing is NOT enabled by this baseline.
