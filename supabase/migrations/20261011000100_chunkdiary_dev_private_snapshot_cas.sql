-- M6: Public CAS RPC is SECURITY INVOKER. The narrow privileged operation
-- lives only in a non-exposed private schema. RLS remains enabled.
-- Authenticated gets USAGE on the schema and EXECUTE on this one function,
-- but no access to the private quota tables or other internal objects.
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
  -- Role and anonymous status are supplied in validated server JWT claims.
  if v_user is null
     or auth.role() <> 'authenticated'
     or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = true then
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

-- SQL functions can be replaced while retaining their public signature.
create or replace function public.chunkdiary_snapshot_cas_write(
  p_payload jsonb, p_expected_checksum text default null
) returns jsonb
language sql security invoker
set search_path = ''
as $$
  select chunkdiary_private.snapshot_cas_write_internal(p_payload,p_expected_checksum);
$$;

revoke all on function chunkdiary_private.snapshot_cas_write_internal(jsonb,text)
  from public, anon;
revoke all on function public.chunkdiary_snapshot_cas_write(jsonb,text)
  from public, anon;
grant usage on schema chunkdiary_private to authenticated;
grant execute on function chunkdiary_private.snapshot_cas_write_internal(jsonb,text)
  to authenticated;
grant execute on function public.chunkdiary_snapshot_cas_write(jsonb,text)
  to authenticated;

-- Private quota config/claims remain entirely inaccessible to client JWTs.
revoke all on chunkdiary_private.ai_quota_config,
  chunkdiary_private.ai_quota_claims from public, anon, authenticated;
revoke insert,update on public.sync_snapshots from authenticated;
