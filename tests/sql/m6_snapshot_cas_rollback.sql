-- DEV ONLY: rollback-only owner-authenticated snapshot CAS regression.
-- Does not expose any test data or require a real linked email identity.
begin;
insert into auth.users(id) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}',true);

do $$
declare
 first jsonb;
 again jsonb;
 stale jsonb;
 target_b jsonb;
 p jsonb := jsonb_build_object(
  'format','chunkdiary.account.cloud-backup',
  'version',1,
  'ownerUserId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'backup',jsonb_build_object('checksum',repeat('a',64))
 );
begin
 select public.chunkdiary_snapshot_cas_write(p,null) into first;
 if first->>'allowed' <> 'true' then
   raise exception 'First linked A CAS denied: %',first;
 end if;
 select public.chunkdiary_snapshot_cas_write(
   p||jsonb_build_object('backup',jsonb_build_object('checksum',repeat('b',64))),null
 ) into stale;
 if stale->>'reason' <> 'CONFLICT' then raise exception 'Blind overwrite permitted: %',stale; end if;
 select public.chunkdiary_snapshot_cas_write(
   p||jsonb_build_object('backup',jsonb_build_object('checksum',repeat('b',64))),repeat('x',64)
 ) into stale;
 if stale->>'reason' <> 'CONFLICT' then raise exception 'Stale CAS accepted: %',stale; end if;
 select public.chunkdiary_snapshot_cas_write(
   p||jsonb_build_object('backup',jsonb_build_object('checksum',repeat('b',64))),repeat('a',64)
 ) into again;
 if again->>'allowed' <> 'true' then raise exception 'Matching CAS denied: %',again; end if;
 select public.chunkdiary_snapshot_cas_write(
   p||jsonb_build_object('ownerUserId','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),null
 ) into target_b;
 if target_b->>'reason' <> 'INVALID_PAYLOAD' then
   raise exception 'Cross-owner CAS was not rejected: %',target_b;
 end if;
end $$;

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}',true);
do $$
declare denied jsonb;
begin
 select public.chunkdiary_snapshot_cas_write(
   jsonb_build_object('format','chunkdiary.account.cloud-backup','version',1,
     'ownerUserId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
     'backup',jsonb_build_object('checksum',repeat('c',64))),
   repeat('b',64)) into denied;
 if denied->>'reason' <> 'UNAUTHORIZED' then
  raise exception 'Anonymous signed-in JWT was allowed to backup: %',denied;
 end if;
end $$;

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}',true);
do $$
declare
 n integer;
begin
 select count(*) into n from public.sync_snapshots;
 if n<>0 then raise exception 'B can read A cloud snapshot'; end if;
 select count(*) into n from public.sync_snapshots
  where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if n<>0 then raise exception 'B can read A by explicit foreign owner filter'; end if;
end $$;
rollback;
