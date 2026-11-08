-- TMP Media Planner production SaaS foundation
-- Apply with Supabase CLI: supabase db push
begin;
create extension if not exists pgcrypto;

do $$ begin
  create type public.workspace_role as enum ('owner','admin','strategist','analyst','viewer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.billing_status as enum ('pending','paid','failed','refunded','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  invited_by uuid references auth.users(id),
  joined_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=auth.uid()) $$;
create or replace function public.has_workspace_role(p_workspace_id uuid,p_roles public.workspace_role[])
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=auth.uid() and m.role=any(p_roles)) $$;
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid,public.workspace_role[]) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid,public.workspace_role[]) to authenticated;

create table if not exists public.media_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null,
  brand text,
  objective text not null default 'Full-funnel growth',
  currency text not null default 'INR',
  total_budget numeric(14,2) not null default 0 check(total_budget>=0),
  duration_days integer not null default 30 check(duration_days between 1 and 730),
  plan_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_plans_workspace_updated_idx on public.media_plans(workspace_id,updated_at desc);

create table if not exists public.media_benchmarks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  platform text not null, objective text not null, industry text,
  country text not null default 'IN', metric text not null,
  metric_value numeric(14,4) not null,
  source_label text not null default 'User supplied historical data',
  source_url text, sample_size integer, observed_on date,
  created_at timestamptz not null default now()
);

-- Price/credit entitlements are authoritative on the server. Never accept amounts/credits from browser input.
create table if not exists public.plan_catalog (
  code text primary key,
  name text not null,
  amount_paise bigint not null check(amount_paise>=0),
  currency text not null default 'INR',
  credits_per_period integer not null check(credits_per_period>=0),
  period_days integer not null check(period_days>0),
  max_seats integer not null check(max_seats>0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.plan_catalog(code,name,amount_paise,currency,credits_per_period,period_days,max_seats)
values
 ('starter','Starter',0,'INR',100,30,1),
 ('solo','Solo',9900,'INR',500,30,1),
 ('agency','Agency',99900,'INR',10000,30,5),
 ('enterprise','Enterprise',499900,'INR',50000,30,25)
on conflict(code) do update set name=excluded.name,amount_paise=excluded.amount_paise,currency=excluded.currency,credits_per_period=excluded.credits_per_period,period_days=excluded.period_days,max_seats=excluded.max_seats;

create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_code text not null references public.plan_catalog(code),
  status text not null check(status in ('trialing','active','past_due','cancelled','expired')),
  credits_total integer not null default 0,
  credits_remaining integer not null default 0,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  razorpay_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_workspace_idx on public.workspace_subscriptions(workspace_id,status,current_period_end desc);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  plan_code text not null references public.plan_catalog(code),
  amount_paise bigint not null,
  currency text not null default 'INR',
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  status public.billing_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists billing_orders_workspace_idx on public.billing_orders(workspace_id,created_at desc);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subscription_id uuid references public.workspace_subscriptions(id),
  amount integer not null check(amount<>0),
  reason text not null,
  reference text not null unique,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_workspace_idx on public.credit_ledger(workspace_id,created_at desc);

create table if not exists public.razorpay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'viewer',
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now()+interval '7 days',
  created_at timestamptz not null default now(),
  unique(workspace_id,email)
);

-- Atomic credit consumption; repeated request references cannot be charged twice.
create or replace function public.consume_workspace_credits(
  p_workspace_id uuid,p_amount integer,p_reason text,p_reference text
) returns table(remaining integer)
language plpgsql security definer set search_path=public
as $$
declare v_sub public.workspace_subscriptions%rowtype;
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a workspace member' using errcode='42501';
  end if;
  if p_amount<=0 or p_amount>100000 then raise exception 'invalid credit amount'; end if;
  if exists(select 1 from public.credit_ledger where reference=p_reference and workspace_id=p_workspace_id) then
    select s.credits_remaining into remaining from public.workspace_subscriptions s
      where s.workspace_id=p_workspace_id and s.status='active' order by s.current_period_end desc limit 1;
    return next; return;
  end if;
  select * into v_sub from public.workspace_subscriptions s
   where s.workspace_id=p_workspace_id and s.status='active' and s.current_period_end>now()
   order by s.current_period_end desc limit 1 for update;
  if not found then raise exception 'no active subscription' using errcode='P0001'; end if;
  if v_sub.credits_remaining<p_amount then raise exception 'insufficient credits' using errcode='P0001'; end if;
  update public.workspace_subscriptions set credits_remaining=credits_remaining-p_amount,updated_at=now() where id=v_sub.id returning credits_remaining into remaining;
  insert into public.credit_ledger(workspace_id,subscription_id,amount,reason,reference,actor_user_id)
  values(p_workspace_id,v_sub.id,-p_amount,p_reason,p_reference,auth.uid());
  return next;
end $$;
revoke all on function public.consume_workspace_credits(uuid,integer,text,text) from public;
grant execute on function public.consume_workspace_credits(uuid,integer,text,text) to authenticated;

-- Service-role-only fulfilment function. Idempotent even when callback and webhook race.
create or replace function public.fulfil_paid_order(p_razorpay_order_id text,p_razorpay_payment_id text,p_amount_paise bigint,p_currency text)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_order public.billing_orders%rowtype; v_plan public.plan_catalog%rowtype; v_sub public.workspace_subscriptions%rowtype;
begin
 select * into v_order from public.billing_orders where razorpay_order_id=p_razorpay_order_id for update;
 if not found then raise exception 'order not found'; end if;
 if v_order.status='paid' then
   if v_order.razorpay_payment_id=p_razorpay_payment_id and v_order.amount_paise=p_amount_paise and v_order.currency=p_currency then return jsonb_build_object('ok',true,'already_processed',true); end if;
   raise exception 'order already fulfilled by a different payment';
 end if;
 select * into v_plan from public.plan_catalog where code=v_order.plan_code and active=true;
 if not found then raise exception 'plan unavailable'; end if;
 if v_order.amount_paise<>v_plan.amount_paise or v_order.currency<>v_plan.currency or v_order.amount_paise<>p_amount_paise or v_order.currency<>p_currency then raise exception 'payment amount or currency mismatch'; end if;
 update public.billing_orders set status='paid',razorpay_payment_id=p_razorpay_payment_id,paid_at=now() where id=v_order.id;
 update public.workspace_subscriptions set status='expired',updated_at=now()
  where workspace_id=v_order.workspace_id and status='active';
 insert into public.workspace_subscriptions(workspace_id,plan_code,status,credits_total,credits_remaining,current_period_start,current_period_end)
 values(v_order.workspace_id,v_plan.code,'active',v_plan.credits_per_period,v_plan.credits_per_period,now(),now()+make_interval(days=>v_plan.period_days))
 returning * into v_sub;
 insert into public.credit_ledger(workspace_id,subscription_id,amount,reason,reference,actor_user_id)
 values(v_order.workspace_id,v_sub.id,v_plan.credits_per_period,'subscription_purchase','purchase:'||v_order.id,v_order.user_id)
 on conflict(reference) do nothing;
 return jsonb_build_object('ok',true,'subscription_id',v_sub.id,'credits',v_plan.credits_per_period);
end $$;
revoke all on function public.fulfil_paid_order(text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.fulfil_paid_order(text,text) to service_role;

-- Provision an initial workspace and free entitlement on first sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $
declare v_workspace uuid; v_slug text; v_invite public.workspace_invites%rowtype; v_invite_id uuid; v_has_invite boolean := false;
begin
 insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''))
 on conflict(id) do nothing;
 begin v_invite_id=(new.raw_user_meta_data->>'tmp_workspace_invite_id')::uuid; exception when others then v_invite_id=null; end;
 if v_invite_id is not null then
   select * into v_invite from public.workspace_invites
    where id=v_invite_id and lower(email)=lower(new.email) and accepted_at is null and expires_at>now()
    for update;
   v_has_invite=found;
 end if;
 if v_has_invite then
   insert into public.workspace_members(workspace_id,user_id,role,invited_by)
   values(v_invite.workspace_id,new.id,v_invite.role,v_invite.invited_by)
   on conflict(workspace_id,user_id) do update set role=excluded.role;
   update public.workspace_invites set accepted_at=now() where id=v_invite.id;
 else
   v_slug=lower(regexp_replace(coalesce(new.raw_user_meta_data->>'company','my-workspace'), '[^a-z0-9]+','-','g'))||'-'||substr(new.id::text,1,8);
   insert into public.workspaces(name,slug,created_by) values(coalesce(nullif(new.raw_user_meta_data->>'company',''),'My workspace'),v_slug,new.id)
   returning id into v_workspace;
   insert into public.workspace_members(workspace_id,user_id,role) values(v_workspace,new.id,'owner');
   insert into public.workspace_subscriptions(workspace_id,plan_code,status,credits_total,credits_remaining,current_period_start,current_period_end)
   select v_workspace,'starter','active',credits_per_period,credits_per_period,now(),now()+make_interval(days=>period_days) from public.plan_catalog where code='starter';
   insert into public.credit_ledger(workspace_id,amount,reason,reference,actor_user_id)
   select v_workspace,credits_per_period,'signup_grant','signup:'||new.id,new.id from public.plan_catalog where code='starter'
   on conflict(reference) do nothing;
 end if;
 return new;
end $;
drop trigger if exists on_auth_user_created_tmp on auth.users;
create trigger on_auth_user_created_tmp after insert on auth.users for each row execute function public.handle_new_user();

-- RLS on all tenant and billing tables.
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.media_plans enable row level security;
alter table public.media_benchmarks enable row level security;
alter table public.plan_catalog enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.billing_orders enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.razorpay_webhook_events enable row level security;
alter table public.workspace_invites enable row level security;

drop policy if exists profile_select_self on public.profiles;
create policy profile_select_self on public.profiles for select to authenticated using(id=auth.uid());
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_self on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

drop policy if exists workspace_read_member on public.workspaces;
create policy workspace_read_member on public.workspaces for select to authenticated using(public.is_workspace_member(id));
drop policy if exists workspace_update_admin on public.workspaces;
create policy workspace_update_admin on public.workspaces for update to authenticated using(public.has_workspace_role(id,array['owner','admin']::public.workspace_role[])) with check(public.has_workspace_role(id,array['owner','admin']::public.workspace_role[]));

drop policy if exists members_read_member on public.workspace_members;
create policy members_read_member on public.workspace_members for select to authenticated using(public.is_workspace_member(workspace_id));
-- Membership writes are performed only by trusted invitation/administration Edge Functions.
-- There is deliberately no client-side INSERT/UPDATE/DELETE policy on workspace_members.

drop policy if exists plans_read_member on public.media_plans;
create policy plans_read_member on public.media_plans for select to authenticated using(public.is_workspace_member(workspace_id));
drop policy if exists plans_create_editor on public.media_plans;
create policy plans_create_editor on public.media_plans for insert to authenticated with check(created_by=auth.uid() and public.has_workspace_role(workspace_id,array['owner','admin','strategist']::public.workspace_role[]));
drop policy if exists plans_update_editor on public.media_plans;
create policy plans_update_editor on public.media_plans for update to authenticated using(public.has_workspace_role(workspace_id,array['owner','admin','strategist']::public.workspace_role[])) with check(public.has_workspace_role(workspace_id,array['owner','admin','strategist']::public.workspace_role[]));
drop policy if exists plans_delete_admin on public.media_plans;
create policy plans_delete_admin on public.media_plans for delete to authenticated using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));

drop policy if exists benchmarks_member_all on public.media_benchmarks;
create policy benchmarks_member_all on public.media_benchmarks for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id));

drop policy if exists catalog_read_active on public.plan_catalog;
create policy catalog_read_active on public.plan_catalog for select to anon,authenticated using(active=true);
drop policy if exists subscriptions_read_member on public.workspace_subscriptions;
create policy subscriptions_read_member on public.workspace_subscriptions for select to authenticated using(public.is_workspace_member(workspace_id));
drop policy if exists orders_read_owner_admin on public.billing_orders;
create policy orders_read_owner_admin on public.billing_orders for select to authenticated using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
drop policy if exists ledger_read_admin on public.credit_ledger;
create policy ledger_read_admin on public.credit_ledger for select to authenticated using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
drop policy if exists invites_read_admin on public.workspace_invites;
create policy invites_read_admin on public.workspace_invites for select to authenticated using(public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
-- Billing orders, subscriptions, ledger and webhook inbox are written only by trusted Edge Functions/service role.
-- No client policies are intentionally created for writes to those tables.
commit;
