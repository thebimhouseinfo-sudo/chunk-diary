-- ChunkDiary M6-C: one active ONLINE learning/cloud-writer session per Auth user.
-- Scope: staging first. Guest cloud write remains DENIED until M6-B2.
-- Uses Supabase Auth-signed session_id claim, not client-chosen device identifiers.
-- No changes to existing owner policies for anonymous Guest backups.
create table if not exists chunkdiary_private.active_learning_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  generation bigint not null default 1 check (generation > 0),
  expires_at timestamptz not null,
  disabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table chunkdiary_private.active_learning_leases enable row level security;
revoke all on chunkdiary_private.active_learning_leases
  from public, anon, authenticated;

-- Critical historical permission hole: direct DELETE bypassed snapshot CAS.
-- Stale devices must NEVER be able to delete a cloud backup directly.
revoke delete on public.sync_snapshots from authenticated;

create or replace function chunkdiary_private.lease_is_active()
returns boolean
language sql security definer stable set search_path = ''
as $$
  select auth.uid() is not null
    and auth.role() = 'authenticated'
    and exists (
      select 1 from chunkdiary_private.active_learning_leases l
      where l.user_id = auth.uid()
        and l.session_id::text = auth.jwt()->>'session_id'
        and l.expires_at > pg_catalog.now()
        and l.disabled = false
    );
$$;
revoke all on function chunkdiary_private.lease_is_active()
  from public, anon, authenticated;

create or replace function public.chunkdiary_lease_check()
returns jsonb
language sql security definer stable set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'allowed', chunkdiary_private.lease_is_active()
  );
$$;
revoke all on function public.chunkdiary_lease_check() from public, anon;
grant execute on function public.chunkdiary_lease_check() to authenticated;

create or replace function public.chunkdiary_lease_acquire(
  p_takeover boolean default false
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session uuid;
  v_existing record;
  v_generation bigint;
  v_expiry timestamptz := pg_catalog.now() + interval '180 seconds';
begin
  if v_user is null or auth.role() <> 'authenticated' then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','AUTH_REQUIRED');
  end if;
  begin
    v_session := pg_catalog.nullif(auth.jwt()->>'session_id','')::uuid;
  exception when others then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','INVALID_SESSION');
  end;
  if v_session is null then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','INVALID_SESSION');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chunkdiary.active_lease:' || v_user::text,0)
  );
  select * into v_existing
    from chunkdiary_private.active_learning_leases
    where user_id = v_user for update;
  if not found then
    insert into chunkdiary_private.active_learning_leases(
      user_id,session_id,generation,expires_at,updated_at
    ) values(v_user,v_session,1,v_expiry,pg_catalog.now());
    v_generation := 1;
  elsif v_existing.disabled then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','OWNER_DISABLED');
  elsif v_existing.session_id = v_session then
    update chunkdiary_private.active_learning_leases
      set expires_at = v_expiry, updated_at = pg_catalog.now()
      where user_id=v_user;
    v_generation := v_existing.generation;
  elsif v_existing.expires_at <= pg_catalog.now() or p_takeover is true then
    update chunkdiary_private.active_learning_leases
      set session_id=v_session, generation=generation+1,
          expires_at=v_expiry, updated_at=pg_catalog.now()
      where user_id=v_user
      returning generation into v_generation;
  else
    return pg_catalog.jsonb_build_object('allowed',false,'reason','ACTIVE_ELSEWHERE');
  end if;
  return pg_catalog.jsonb_build_object(
    'allowed',true,'generation',v_generation,'expiresAt',v_expiry
  );
end $$;
revoke all on function public.chunkdiary_lease_acquire(boolean)
  from public, anon;
grant execute on function public.chunkdiary_lease_acquire(boolean)
  to authenticated;

-- Preserve the exact prior CAS contract, owner binding, size limit, checksum,
-- owner-scoped advisory lock and optimistic concurrency; insert LEASE gate.
create or replace function chunkdiary_private.snapshot_cas_write_internal(
  p_payload jsonb, p_expected_checksum text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_existing jsonb;
  v_existing_checksum text;
  v_requested_checksum text;
  v_rows integer;
begin
  if v_user is null
     or auth.role() <> 'authenticated'
     or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = true
     or not chunkdiary_private.lease_is_active() then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','UNAUTHORIZED');
  end if;
  if p_payload is null
     or p_payload->>'format' <> 'chunkdiary.account.cloud-backup'
     or p_payload->>'version' <> '1'
     or p_payload->>'ownerUserId' <> v_user::text
     or pg_catalog.octet_length(p_payload::text) > 5242880 then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','INVALID_PAYLOAD');
  end if;
  v_requested_checksum := p_payload->'backup'->>'checksum';
  if v_requested_checksum is null or
     v_requested_checksum !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','INVALID_CHECKSUM');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chunkdiary.snapshot:' || v_user::text, 0)
  );
  select payload into v_existing
    from public.sync_snapshots where user_id = v_user for update;
  if found then
    v_existing_checksum := v_existing->'backup'->>'checksum';
    if p_expected_checksum is null or
       p_expected_checksum is distinct from v_existing_checksum then
      return pg_catalog.jsonb_build_object(
        'allowed',false,'reason','CONFLICT','checksum',v_existing_checksum
      );
    end if;
    update public.sync_snapshots
       set payload = p_payload, updated_at = pg_catalog.now()
       where user_id = v_user;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'snapshot CAS update failed'; end if;
  else
    if p_expected_checksum is not null then
      return pg_catalog.jsonb_build_object('allowed',false,'reason','CONFLICT');
    end if;
    insert into public.sync_snapshots(user_id,payload,updated_at)
      values(v_user,p_payload,pg_catalog.now());
  end if;
  return pg_catalog.jsonb_build_object(
    'allowed',true,'reason','SAVED','checksum',v_requested_checksum
  );
end $$;
-- Do not grant authenticated users direct access to private internals.
revoke all on function chunkdiary_private.snapshot_cas_write_internal(jsonb,text)
  from public,anon;
grant execute on function chunkdiary_private.snapshot_cas_write_internal(jsonb,text)
  to authenticated;
