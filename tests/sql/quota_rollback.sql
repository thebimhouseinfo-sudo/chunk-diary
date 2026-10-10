-- M4: synthetic SQL quota test, one transaction and an unconditional ROLLBACK.
-- Does not invoke Edge Function or Gemini. Does not permanently enable budget.
begin;
insert into auth.users(id) values
('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
('ccccccc2-cccc-4ccc-8ccc-cccccccccccc');

update chunkdiary_private.ai_quota_config
set enabled=true,user_day_limit=1,global_day_limit=2,global_month_limit=2 where id=1;
-- Impersonation is restricted to the SQL admin test transaction; the public
-- RPC remains GRANTed solely to service_role in the actual database.
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;

do $$
declare result jsonb;
begin
  select public.chunkdiary_ai_quota_claim(
    'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111112-1111-4111-8111-111111111111') into result;
  if result->>'allowed' <> 'true' or result->>'new_claim' <> 'true' then
    raise exception 'A initial quota claim denied unexpectedly';
  end if;

  select public.chunkdiary_ai_quota_claim(
    'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111112-1111-4111-8111-111111111111') into result;
  if result->>'allowed' <> 'false' then
    raise exception 'duplicate A claim allowed';
  end if;

  select public.chunkdiary_ai_quota_claim(
    'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222') into result;
  if result->>'allowed' <> 'false' then
    raise exception 'A exceeded per-user daily cap';
  end if;

  select public.chunkdiary_ai_quota_claim(
    'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '33333333-3333-4333-8333-333333333333') into result;
  if result->>'allowed' <> 'true' then
    raise exception 'B initial quota claim denied unexpectedly';
  end if;

  select public.chunkdiary_ai_quota_claim(
    'ccccccc2-cccc-4ccc-8ccc-cccccccccccc',
    '44444444-4444-4444-8444-444444444444') into result;
  if result->>'allowed' <> 'false' then
    raise exception 'C exceeded global daily/monthly caps';
  end if;
end $$;
rollback;
