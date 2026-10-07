-- Annual company licences. Commercial data is private, not writable through
-- tenant membership policies. Operators are provisioned by the database owner.
create schema if not exists aeoi_private;
revoke all on schema aeoi_private from public, anon;
grant usage on schema aeoi_private to authenticated, service_role;

-- Membership policies previously queried organizations, whose own SELECT
-- policy queried memberships again. PostgreSQL detects that recursion before
-- evaluating even an owner's row. This scoped owner lookup breaks the cycle.
create function aeoi_private.is_company_owner(p_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.organizations where id=p_org and created_by=auth.uid());
$$;
revoke all on function aeoi_private.is_company_owner(uuid) from public,anon;
grant execute on function aeoi_private.is_company_owner(uuid) to authenticated;
drop policy "membership select own or org owner" on public.organization_members;
create policy "membership select own or org owner" on public.organization_members for select to authenticated
using (user_id=(select auth.uid()) or aeoi_private.is_company_owner(organization_id));
drop policy "membership insert by org owner" on public.organization_members;
create policy "membership insert by org owner" on public.organization_members for insert to authenticated
with check (aeoi_private.is_company_owner(organization_id));
drop policy "membership update by org owner" on public.organization_members;
create policy "membership update by org owner" on public.organization_members for update to authenticated
using (aeoi_private.is_company_owner(organization_id)) with check (aeoi_private.is_company_owner(organization_id));
drop policy "membership delete by org owner" on public.organization_members;
create policy "membership delete by org owner" on public.organization_members for delete to authenticated
using (aeoi_private.is_company_owner(organization_id) and role<>'owner');

create table aeoi_private.operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table aeoi_private.plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name text not null check (length(trim(name)) between 2 and 100),
  filing_limit integer not null check (filing_limit between 1 and 1000000),
  institution_limit integer not null check (institution_limit between 1 and 10000),
  price_minor bigint check (price_minor between 1 and 100000000),
  currency text not null check (currency in ('USD','EUR','GBP','MUR')),
  available boolean not null default false
);
insert into aeoi_private.plans values
  ('evaluation','Evaluation',3,1,null,'USD',false),
  ('professional','Professional',50,5,null,'USD',false),
  ('firm','Firm',250,50,null,'USD',false);

create table aeoi_private.contracts (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  plan_id text not null references aeoi_private.plans(id),
  status text not null check (status in ('evaluation','active','suspended')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  filing_limit integer not null check (filing_limit > 0),
  institution_limit integer not null check (institution_limit > 0),
  check (period_end > period_start)
);
create table aeoi_private.payment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_id text not null references aeoi_private.plans(id),
  plan_name text not null,
  filing_limit integer not null,
  institution_limit integer not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('USD','EUR','GBP','MUR')),
  status text not null default 'issued' check (status in ('issued','paid','void','refunded')),
  provider_order_id text unique,
  provider_capture_id text unique,
  payment_method text check (payment_method in ('paypal','bank_transfer')),
  payment_reference text,
  period_start timestamptz,
  period_end timestamptz,
  issued_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((period_start is null and period_end is null) or period_end > period_start)
);
create unique index payment_one_open_request on aeoi_private.payment_requests(organization_id) where status='issued';
create index payment_company_created on aeoi_private.payment_requests(organization_id,created_at desc);
create table aeoi_private.commercial_audit (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  request_id uuid references aeoi_private.payment_requests(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table aeoi_private.payment_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
alter table aeoi_private.operators enable row level security;
alter table aeoi_private.plans enable row level security;
alter table aeoi_private.contracts enable row level security;
alter table aeoi_private.payment_requests enable row level security;
alter table aeoi_private.commercial_audit enable row level security;
alter table aeoi_private.payment_webhook_events enable row level security;
revoke all on all tables in schema aeoi_private from public, anon, authenticated;

create function aeoi_private.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from aeoi_private.operators where user_id=auth.uid());
$$;
create function aeoi_private.require_operator() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not aeoi_private.is_operator() then raise exception 'Evologics operator access required' using errcode='42501'; end if;
end;
$$;
create function aeoi_private.require_member(p_org uuid, p_manage boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid()
      and (not p_manage or role in ('owner','admin'))
  ) then raise exception 'Company billing access denied' using errcode='42501'; end if;
end;
$$;

-- New and existing companies start in an explicitly limited pilot. Existing
-- institutions are preserved: the evaluation institution cap accommodates them.
create function aeoi_private.start_evaluation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users where id=new.created_by for update;
  if exists(select 1 from public.organizations o join aeoi_private.contracts c on c.organization_id=o.id
    where o.created_by=new.created_by and c.plan_id='evaluation') then
    raise exception 'Only one evaluation company is available per account. Contact Evologics for additional company licences.';
  end if;
  insert into aeoi_private.contracts values(new.id,'evaluation','evaluation',now(),now()+interval '30 days',3,1);
  return new;
end;
$$;
create trigger commercial_new_company after insert on public.organizations
for each row execute function aeoi_private.start_evaluation();
insert into aeoi_private.contracts
select o.id,'evaluation','evaluation',now(),now()+interval '30 days',3,
  greatest(1,(select count(*)::int from public.reporting_institutions ri where ri.organization_id=o.id and ri.active))
from public.organizations o;

-- Lock the company contract throughout the filing transaction. Concurrent
-- successful writes cannot overspend the shared allowance. Failed writes roll
-- back and consume nothing. Repeated MessageRefIds retain the ledger's unique
-- constraint. Corrections/amendments/voids are tracked but do not consume quota.
create function aeoi_private.enforce_commercial_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c aeoi_private.contracts; used bigint;
begin
  perform aeoi_private.activate_renewal(new.organization_id);
  select * into c from aeoi_private.contracts where organization_id=new.organization_id for update;
  if not found or c.status='suspended' or now()>=c.period_end or now()<c.period_start
  then raise exception 'Company licence is inactive. Open Company and billing to renew or contact Evologics.'; end if;
  if tg_table_name='filings' then
    if new.filing_kind in ('new','nil') then
      select count(*) into used from public.filings f where f.organization_id=new.organization_id
        and f.created_at>=c.period_start and f.created_at<c.period_end and f.filing_kind in ('new','nil');
      if used>=c.filing_limit then raise exception 'Company filing allowance reached. Corrections do not consume allowance.'; end if;
    end if;
  elsif new.active and (tg_op='INSERT' or not old.active or old.organization_id<>new.organization_id) then
    select count(*) into used from public.reporting_institutions ri
    where ri.organization_id=new.organization_id and ri.active and ri.id<>new.id;
    if used>=c.institution_limit then raise exception 'Company reporting-institution allowance reached'; end if;
  end if;
  return new;
end;
$$;
create trigger commercial_filing_limit before insert on public.filings
for each row execute function aeoi_private.enforce_commercial_limits();
create trigger commercial_institution_limit before insert or update on public.reporting_institutions
for each row execute function aeoi_private.enforce_commercial_limits();

create function aeoi_private.company_billing(p_org uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not aeoi_private.is_operator() then perform aeoi_private.require_member(p_org); end if;
  perform aeoi_private.activate_renewal(p_org);
  select jsonb_build_object(
    'organization_id',c.organization_id,'plan_id',c.plan_id,'plan_name',p.name,
    'status',case when now()>=c.period_end then 'expired' else c.status end,
    'period_start',c.period_start,'period_end',c.period_end,
    'filing_limit',c.filing_limit,'institution_limit',c.institution_limit,
    'filings_used',(select count(*) from public.filings f where f.organization_id=p_org and f.created_at>=c.period_start and f.created_at<c.period_end and f.filing_kind in ('new','nil')),
    'institution_count',(select count(*) from public.reporting_institutions ri where ri.organization_id=p_org and ri.active),
    'can_manage',exists(select 1 from public.organization_members m where m.organization_id=p_org and m.user_id=auth.uid() and m.role in ('owner','admin')),
    'institutions',coalesce((select jsonb_agg(jsonb_build_object('id',ri.id,'name',ri.legal_name,
      'crs_filings',(select count(*) from public.filings f where f.institution_id=ri.id and f.regime='CRS'),
      'fatca_filings',(select count(*) from public.filings f where f.institution_id=ri.id and f.regime='FATCA')) order by ri.legal_name)
      from public.reporting_institutions ri where ri.organization_id=p_org),'[]'::jsonb),
    'payment_requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'plan_name',r.plan_name,'amount_minor',r.amount_minor,
      'currency',r.currency,'status',r.status,'created_at',r.created_at,'paid_at',r.paid_at,'payment_method',r.payment_method,
      'period_start',r.period_start,'period_end',r.period_end) order by r.created_at desc)
      from aeoi_private.payment_requests r where r.organization_id=p_org),'[]'::jsonb)
  ) into result from aeoi_private.contracts c join aeoi_private.plans p on p.id=c.plan_id where c.organization_id=p_org;
  return result;
end;
$$;
create function aeoi_private.admin_dashboard() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform aeoi_private.require_operator();
  return jsonb_build_object(
    'companies',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'created_at',o.created_at,
      'billing',aeoi_private.company_billing(o.id),
      'filings_total',(select count(*) from public.filings f where f.organization_id=o.id),
      'filings_30_days',(select count(*) from public.filings f where f.organization_id=o.id and f.created_at>=now()-interval '30 days'),
      'last_filing_at',(select max(created_at) from public.filings f where f.organization_id=o.id)) order by o.created_at desc)
      from public.organizations o),'[]'::jsonb),
    'plans',(select jsonb_agg(to_jsonb(p) order by p.filing_limit) from aeoi_private.plans p),
    'paid_totals',coalesce((select jsonb_agg(to_jsonb(t)) from (select currency,sum(amount_minor) amount_minor,count(*) requests from aeoi_private.payment_requests where status='paid' group by currency) t),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select id,organization_id,event_type,request_id,created_at from aeoi_private.commercial_audit order by created_at desc limit 50) a),'[]'::jsonb)
  );
end;
$$;
create function aeoi_private.configure_plan(p_id text,p_name text,p_filings integer,p_institutions integer,p_price bigint,p_currency text,p_available boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform aeoi_private.require_operator();
  if p_id='evaluation' then raise exception 'Evaluation plan is managed by migration'; end if;
  if p_available and p_price is null then raise exception 'Set a price before publishing a plan'; end if;
  insert into aeoi_private.plans values(p_id,trim(p_name),p_filings,p_institutions,p_price,p_currency,p_available)
  on conflict(id) do update set name=excluded.name,filing_limit=excluded.filing_limit,institution_limit=excluded.institution_limit,
    price_minor=excluded.price_minor,currency=excluded.currency,available=excluded.available;
  insert into aeoi_private.commercial_audit(actor_user_id,event_type,metadata) values(auth.uid(),'plan.configured',jsonb_build_object('plan_id',p_id));
end;
$$;
create function aeoi_private.issue_request(p_org uuid,p_plan text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p aeoi_private.plans; result uuid;
begin
  perform aeoi_private.require_operator();
  select * into p from aeoi_private.plans where id=p_plan and available and price_minor is not null;
  if not found then raise exception 'Configure and publish the plan price first'; end if;
  if exists(select 1 from aeoi_private.payment_requests where organization_id=p_org and status='paid' and period_start>now())
  then raise exception 'This company already has a paid renewal queued'; end if;
  insert into aeoi_private.payment_requests(organization_id,plan_id,plan_name,filing_limit,institution_limit,amount_minor,currency,issued_by)
  values(p_org,p.id,p.name,p.filing_limit,p.institution_limit,p.price_minor,p.currency,auth.uid()) returning id into result;
  insert into aeoi_private.commercial_audit(organization_id,actor_user_id,event_type,request_id) values(p_org,auth.uid(),'payment_request.issued',result);
  return result;
end;
$$;

-- The same atomic settlement is used by a verified provider capture and an
-- operator-confirmed bank transfer. The annual term extends an active licence
-- only for the same plan; a plan change begins a new term immediately.
create function aeoi_private.settle_request(p_id uuid,p_method text,p_reference text,p_amount bigint,p_currency text) returns void
language plpgsql security definer set search_path = '' as $$
declare r aeoi_private.payment_requests; c aeoi_private.contracts; starts timestamptz;
begin
  select * into r from aeoi_private.payment_requests where id=p_id for update;
  if not found then raise exception 'Payment request not found'; end if;
  if r.amount_minor<>p_amount or r.currency<>p_currency or length(trim(p_reference))<3 then raise exception 'Payment amount, currency or reference does not match'; end if;
  if r.status='paid' and r.payment_method=p_method and r.payment_reference=p_reference then return; end if;
  if r.status<>'issued' then raise exception 'Payment request is not payable'; end if;
  select * into c from aeoi_private.contracts where organization_id=r.organization_id for update;
  if exists(select 1 from aeoi_private.payment_requests q where q.organization_id=r.organization_id
    and q.status='paid' and q.period_start>now()) then raise exception 'A paid renewal is already queued for this company'; end if;
  starts:=case when c.status='active' and c.period_end>now() and c.plan_id=r.plan_id then c.period_end else now() end;
  update aeoi_private.payment_requests set status='paid',paid_at=now(),payment_method=p_method,payment_reference=p_reference,
    provider_capture_id=case when p_method='paypal' then p_reference else null end,
    period_start=starts,period_end=starts+interval '1 year' where id=p_id;
  -- A renewal is queued until the current annual period ends; existing quota
  -- and term stay intact until the next filing or billing read activates it.
  if starts<=now() and c.status<>'suspended' then
    update aeoi_private.contracts set plan_id=r.plan_id,status='active',period_start=starts,period_end=starts+interval '1 year',
      filing_limit=r.filing_limit,institution_limit=r.institution_limit where organization_id=r.organization_id;
  end if;
  insert into aeoi_private.commercial_audit(organization_id,actor_user_id,event_type,request_id,metadata)
  values(r.organization_id,auth.uid(),'payment.confirmed',p_id,jsonb_build_object('method',p_method,'amount_minor',p_amount,'currency',p_currency));
end;
$$;
create function aeoi_private.activate_renewal(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r aeoi_private.payment_requests;
begin
  perform 1 from aeoi_private.contracts where organization_id=p_org for update;
  select * into r from aeoi_private.payment_requests where organization_id=p_org and status='paid' and period_start<=now() and period_end>now() order by period_start desc limit 1;
  if found then
    update aeoi_private.contracts set plan_id=r.plan_id,period_start=r.period_start,period_end=r.period_end,
      filing_limit=r.filing_limit,institution_limit=r.institution_limit
    where organization_id=p_org and status<>'suspended' and period_start<r.period_start;
  end if;
end;
$$;
-- Activate a queued renewal before enforcing quotas. A suspended licence
-- requires an explicit operator resolution; payment alone does not bypass it.
create function aeoi_private.renew_before_filing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform aeoi_private.activate_renewal(new.organization_id); return new; end;
$$;
create trigger aa_commercial_renewal before insert on public.filings
for each row execute function aeoi_private.renew_before_filing();

create function aeoi_private.record_bank_payment(p_id uuid,p_reference text,p_amount bigint,p_currency text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform aeoi_private.require_operator();
  perform aeoi_private.settle_request(p_id,'bank_transfer',p_reference,p_amount,p_currency);
end;
$$;
create function aeoi_private.change_request(p_id uuid,p_action text,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare r aeoi_private.payment_requests;
begin
  perform aeoi_private.require_operator();
  if length(trim(p_reason))<5 then raise exception 'A reason of at least five characters is required'; end if;
  select * into r from aeoi_private.payment_requests where id=p_id for update;
  if not found then raise exception 'Payment request not found'; end if;
  if p_action='void' and r.status='issued' and r.provider_order_id is null then
    update aeoi_private.payment_requests set status='void' where id=p_id;
  elsif p_action='suspend' and r.status='paid' then
    update aeoi_private.contracts set status='suspended' where organization_id=r.organization_id;
  elsif p_action='restore' and r.status='paid' and r.period_start<=now() and r.period_end>now() then
    update aeoi_private.contracts set status='active',plan_id=r.plan_id,period_start=r.period_start,period_end=r.period_end,
      filing_limit=r.filing_limit,institution_limit=r.institution_limit where organization_id=r.organization_id;
  else raise exception 'Invalid request action for its current state'; end if;
  insert into aeoi_private.commercial_audit(organization_id,actor_user_id,event_type,request_id,metadata)
  values(r.organization_id,auth.uid(),'payment_request.'||p_action,p_id,jsonb_build_object('reason',p_reason));
end;
$$;
create function aeoi_private.payable_request(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r aeoi_private.payment_requests;
begin
  select * into r from aeoi_private.payment_requests where id=p_id;
  if not found then raise exception 'Payment request not found'; end if;
  perform aeoi_private.require_member(r.organization_id,true);
  if r.status not in ('issued','paid') then raise exception 'Payment request is not payable'; end if;
  return to_jsonb(r);
end;
$$;

-- Service-only APIs are called by the payment Edge Function after provider
-- authentication/verification. No browser or company role may invoke them.
create function aeoi_private.bind_order(p_id uuid,p_order text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update aeoi_private.payment_requests set provider_order_id=p_order
  where id=p_id and status='issued' and (provider_order_id is null or provider_order_id=p_order);
  if not found then raise exception 'Payment request changed while checkout was starting'; end if;
end;
$$;
create function aeoi_private.provider_payment(p_id uuid,p_order text,p_capture text,p_amount bigint,p_currency text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from aeoi_private.payment_requests where id=p_id and provider_order_id=p_order)
  then raise exception 'Provider order does not match payment request'; end if;
  perform aeoi_private.settle_request(p_id,'paypal',p_capture,p_amount,p_currency);
end;
$$;
create function aeoi_private.provider_webhook(p_event text,p_type text,p_order text,p_capture text,p_amount bigint,p_currency text,p_refunded boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare r aeoi_private.payment_requests;
begin
  insert into aeoi_private.payment_webhook_events(event_id,event_type) values(p_event,p_type) on conflict do nothing;
  if not found then return; end if;
  select * into r from aeoi_private.payment_requests where provider_order_id=p_order for update;
  if not found then raise exception 'Unknown provider order'; end if;
  if p_refunded then
    if r.status not in ('paid','refunded') or r.provider_capture_id is distinct from p_capture or r.amount_minor<>p_amount or r.currency<>p_currency then raise exception 'Refund capture does not match'; end if;
    update aeoi_private.payment_requests set status='refunded' where id=r.id;
    update aeoi_private.contracts set status='suspended' where organization_id=r.organization_id;
    insert into aeoi_private.commercial_audit(organization_id,event_type,request_id) values(r.organization_id,'payment.refunded_or_reversed',r.id);
  else
    if r.status='refunded' and r.provider_capture_id=p_capture then return; end if;
    perform aeoi_private.provider_payment(r.id,p_order,p_capture,p_amount,p_currency);
  end if;
end;
$$;

-- Exposed functions are invoker wrappers; privileged implementations remain
-- in the unexposed schema and enforce member/operator checks on every call.
create function public.aeoi_commercial_access() returns boolean language sql security invoker set search_path='' as $$ select aeoi_private.is_operator(); $$;
create function public.aeoi_company_billing(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$ select aeoi_private.company_billing(p_org); $$;
create function public.aeoi_admin_dashboard() returns jsonb language sql security invoker set search_path='' as $$ select aeoi_private.admin_dashboard(); $$;
create function public.aeoi_configure_plan(p_id text,p_name text,p_filings integer,p_institutions integer,p_price bigint,p_currency text,p_available boolean) returns void language sql security invoker set search_path='' as $$ select aeoi_private.configure_plan(p_id,p_name,p_filings,p_institutions,p_price,p_currency,p_available); $$;
create function public.aeoi_issue_payment_request(p_org uuid,p_plan text) returns uuid language sql security invoker set search_path='' as $$ select aeoi_private.issue_request(p_org,p_plan); $$;
create function public.aeoi_record_bank_payment(p_id uuid,p_reference text,p_amount bigint,p_currency text) returns void language sql security invoker set search_path='' as $$ select aeoi_private.record_bank_payment(p_id,p_reference,p_amount,p_currency); $$;
create function public.aeoi_change_payment_request(p_id uuid,p_action text,p_reason text) returns void language sql security invoker set search_path='' as $$ select aeoi_private.change_request(p_id,p_action,p_reason); $$;
create function public.aeoi_payable_request(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select aeoi_private.payable_request(p_id); $$;
create function public.aeoi_bind_payment_order(p_id uuid,p_order text) returns void language sql security invoker set search_path='' as $$ select aeoi_private.bind_order(p_id,p_order); $$;
create function public.aeoi_provider_payment(p_id uuid,p_order text,p_capture text,p_amount bigint,p_currency text) returns void language sql security invoker set search_path='' as $$ select aeoi_private.provider_payment(p_id,p_order,p_capture,p_amount,p_currency); $$;
create function public.aeoi_provider_webhook(p_event text,p_type text,p_order text,p_capture text,p_amount bigint,p_currency text,p_refunded boolean) returns void language sql security invoker set search_path='' as $$ select aeoi_private.provider_webhook(p_event,p_type,p_order,p_capture,p_amount,p_currency,p_refunded); $$;

-- Functions default to PUBLIC execute in PostgreSQL. Remove that default for
-- every new commercial function, then grant only the intended API surface.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='aeoi_private'::regnamespace and proname in
    ('is_operator','require_operator','require_member','start_evaluation','enforce_commercial_limits','company_billing','admin_dashboard','configure_plan','issue_request','settle_request','activate_renewal','renew_before_filing','record_bank_payment','change_request','payable_request','bind_order','provider_payment','provider_webhook')
    or pronamespace='public'::regnamespace and proname in ('aeoi_commercial_access','aeoi_company_billing','aeoi_admin_dashboard','aeoi_configure_plan','aeoi_issue_payment_request','aeoi_record_bank_payment','aeoi_change_payment_request','aeoi_payable_request','aeoi_bind_payment_order','aeoi_provider_payment','aeoi_provider_webhook')
  loop execute format('revoke all on function %s from public, anon, authenticated',f.signature); end loop;
end $$;
grant execute on function aeoi_private.is_operator(),aeoi_private.company_billing(uuid),aeoi_private.admin_dashboard(),aeoi_private.configure_plan(text,text,integer,integer,bigint,text,boolean),aeoi_private.issue_request(uuid,text),aeoi_private.record_bank_payment(uuid,text,bigint,text),aeoi_private.change_request(uuid,text,text),aeoi_private.payable_request(uuid) to authenticated;
grant execute on function public.aeoi_commercial_access(),public.aeoi_company_billing(uuid),public.aeoi_admin_dashboard(),public.aeoi_configure_plan(text,text,integer,integer,bigint,text,boolean),public.aeoi_issue_payment_request(uuid,text),public.aeoi_record_bank_payment(uuid,text,bigint,text),public.aeoi_change_payment_request(uuid,text,text),public.aeoi_payable_request(uuid) to authenticated;
grant execute on function aeoi_private.bind_order(uuid,text),aeoi_private.provider_payment(uuid,text,text,bigint,text),aeoi_private.provider_webhook(text,text,text,text,bigint,text,boolean) to service_role;
grant execute on function public.aeoi_bind_payment_order(uuid,text),public.aeoi_provider_payment(uuid,text,text,bigint,text),public.aeoi_provider_webhook(text,text,text,text,bigint,text,boolean) to service_role;
