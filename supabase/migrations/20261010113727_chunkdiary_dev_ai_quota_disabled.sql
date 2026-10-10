-- Development-only, disabled by default. Never use client-supplied quota limits.
create schema if not exists chunkdiary_private;
revoke all on schema chunkdiary_private from public, anon, authenticated;

create table chunkdiary_private.ai_quota_config (
 id integer primary key check (id = 1),
 enabled boolean not null default false,
 user_day_limit integer not null default 2 check (user_day_limit between 1 and 10),
 global_day_limit integer not null default 50 check (global_day_limit between 1 and 500),
 global_month_limit integer not null default 500 check (global_month_limit between 1 and 5000)
);
insert into chunkdiary_private.ai_quota_config(id) values(1);
create table chunkdiary_private.ai_quota_claims (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id, request_id)
);
create index on chunkdiary_private.ai_quota_claims(created_at);
create index on chunkdiary_private.ai_quota_claims(user_id, created_at);
revoke all on chunkdiary_private.ai_quota_config, chunkdiary_private.ai_quota_claims
 from public, anon, authenticated;
alter table chunkdiary_private.ai_quota_config enable row level security;
alter table chunkdiary_private.ai_quota_claims enable row level security;

create function public.chunkdiary_ai_quota_claim(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 u uuid := auth.uid();
 cfg record;
 day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
 month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
 n integer;
 denied jsonb := jsonb_build_object('allowed', false, 'new_claim', false);
begin
 if u is null or auth.role() <> 'authenticated' or p_request_id is null then return denied; end if;
 perform pg_catalog.pg_advisory_xact_lock(584137, 1);
 select * into cfg from chunkdiary_private.ai_quota_config where id = 1;
 if not found or cfg.enabled is not true then return denied; end if;
 if exists(select 1 from chunkdiary_private.ai_quota_claims
           where user_id = u and request_id = p_request_id) then return denied; end if;
 select count(*) into n from chunkdiary_private.ai_quota_claims
   where user_id = u and created_at >= day_start;
 if n >= cfg.user_day_limit then return denied; end if;
 select count(*) into n from chunkdiary_private.ai_quota_claims where created_at >= day_start;
 if n >= cfg.global_day_limit then return denied; end if;
 select count(*) into n from chunkdiary_private.ai_quota_claims where created_at >= month_start;
 if n >= cfg.global_month_limit then return denied; end if;
 insert into chunkdiary_private.ai_quota_claims(user_id, request_id) values(u,p_request_id);
 return jsonb_build_object('allowed',true,'new_claim',true);
end $$;
revoke all on function public.chunkdiary_ai_quota_claim(uuid) from public, anon;
grant execute on function public.chunkdiary_ai_quota_claim(uuid) to authenticated;
