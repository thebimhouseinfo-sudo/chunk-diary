-- Limit provider budget claims to the server-only Edge service role.
-- The Edge gateway first validates the user's access token with auth/v1/user.
-- No authenticated client can call this RPC directly to exhaust quotas.
drop function if exists public.chunkdiary_ai_quota_claim(uuid);

create function public.chunkdiary_ai_quota_claim(p_user_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 cfg record;
 day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
 month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
 n integer;
 denied jsonb := jsonb_build_object('allowed', false, 'new_claim', false);
begin
 if auth.role() <> 'service_role' or p_user_id is null or p_request_id is null then
   return denied;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(584137, 1);
 select * into cfg from chunkdiary_private.ai_quota_config where id = 1;
 if not found or cfg.enabled is not true then return denied; end if;
 if exists(select 1 from chunkdiary_private.ai_quota_claims
           where user_id = p_user_id and request_id = p_request_id) then return denied; end if;
 select count(*) into n from chunkdiary_private.ai_quota_claims
   where user_id = p_user_id and created_at >= day_start;
 if n >= cfg.user_day_limit then return denied; end if;
 select count(*) into n from chunkdiary_private.ai_quota_claims where created_at >= day_start;
 if n >= cfg.global_day_limit then return denied; end if;
 select count(*) into n from chunkdiary_private.ai_quota_claims where created_at >= month_start;
 if n >= cfg.global_month_limit then return denied; end if;
 insert into chunkdiary_private.ai_quota_claims(user_id, request_id) values(p_user_id,p_request_id);
 return jsonb_build_object('allowed',true,'new_claim',true);
end $$;
revoke all on function public.chunkdiary_ai_quota_claim(uuid,uuid)
 from public, anon, authenticated;
grant execute on function public.chunkdiary_ai_quota_claim(uuid,uuid)
 to service_role;
