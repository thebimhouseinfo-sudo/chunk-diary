-- ChunkDiary development RLS regression. Uses synthetic auth users and
-- always ROLLBACKs. MUST NOT run against live user data / production.
begin;
insert into auth.users(id) values
 ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

insert into public.user_settings(user_id,settings)
 values('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"name":"A"}');
insert into public.user_progress(user_id,id,payload)
 values('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','same-old-id','{"stars":5}');
insert into public.sync_snapshots(user_id,payload)
 values('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"version":1}');
insert into public.generated_chunk_corpus(user_id,id,payload)
 values('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','same-old-id','{"chunk":"A"}');

do $$
declare t text; n integer; was_blocked boolean;
begin
 foreach t in array array['user_settings','user_progress','sync_snapshots','generated_chunk_corpus']
 loop
  execute format('select count(*) from public.%I where user_id = $1',t)
    into n using 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  if n <> 1 then raise exception '%: cannot read own data',t; end if;

  execute format('select count(*) from public.%I where user_id = $1',t)
    into n using 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid;
  if n <> 0 then raise exception '%: leaked user B data to A',t; end if;

  execute format('update public.%I set updated_at = now() where user_id = $1',t)
    using 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '%: cross-owner UPDATE allowed',t; end if;

  execute format('delete from public.%I where user_id = $1',t)
    using 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '%: cross-owner DELETE allowed',t; end if;
 end loop;

 was_blocked := false;
 begin
  insert into public.user_progress(user_id,id,payload)
   values('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb','foreign-id','{}');
 exception when insufficient_privilege then was_blocked := true;
 end;
 if not was_blocked then raise exception 'cross-owner INSERT allowed'; end if;
end $$;

select set_config('request.jwt.claim.sub','bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into public.user_settings(user_id,settings)
 values('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"name":"B"}');
insert into public.user_progress(user_id,id,payload)
 values('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb','same-old-id','{"stars":3}');
insert into public.sync_snapshots(user_id,payload)
 values('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"version":2}');
insert into public.generated_chunk_corpus(user_id,id,payload)
 values('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb','same-old-id','{"chunk":"B"}');

do $$
declare t text; n integer;
begin
 foreach t in array array['user_settings','user_progress','sync_snapshots','generated_chunk_corpus']
 loop
  execute format('select count(*) from public.%I',t) into n;
  if n <> 1 then raise exception '%: user B sees wrong row count %',t,n; end if;
 end loop;
end $$;

rollback;
