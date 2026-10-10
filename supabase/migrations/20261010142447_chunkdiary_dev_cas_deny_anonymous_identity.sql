CREATE OR REPLACE FUNCTION public.chunkdiary_snapshot_cas_write(p_payload jsonb, p_expected_checksum text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_existing jsonb;
  v_existing_checksum text;
  v_requested_checksum text;
  v_rows integer;
begin
  if v_user is null or auth.role() <> 'authenticated' or
     coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = true then
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
  -- A serializable owner-specific critical section for both INSERT and UPDATE.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chunkdiary.snapshot:'||v_user::text, 0)
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
      set payload=p_payload, updated_at=pg_catalog.now()
      where user_id=v_user;
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
end $function$
;
