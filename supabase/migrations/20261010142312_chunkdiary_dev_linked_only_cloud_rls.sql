-- ChunkDiary M6: Anonymous Supabase Auth JWTs must NOT own cloud backup data.
-- Anonymous sessions remain supported for single-request AI generation.
-- Linked identities only for all user-owned cloud data tables.
drop policy if exists "settings_owner" on public.user_settings;
create policy "settings_owner" on public.user_settings
for all to authenticated
using (user_id = (select auth.uid())
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false)
with check (user_id = (select auth.uid())
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);

drop policy if exists "progress_owner" on public.user_progress;
create policy "progress_owner" on public.user_progress
for all to authenticated
using (user_id = (select auth.uid())
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false)
with check (user_id = (select auth.uid())
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);

drop policy if exists "snapshot_owner" on public.sync_snapshots;
create policy "snapshot_owner" on public.sync_snapshots
for all to authenticated
using (user_id = (select auth.uid())
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false)
with check (user_id = (select auth.uid())
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);

drop policy if exists "corpus_owner" on public.generated_chunk_corpus;
create policy "corpus_owner" on public.generated_chunk_corpus
for all to authenticated
using (user_id = (select auth.uid())
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false)
with check (user_id = (select auth.uid())
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
