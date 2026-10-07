-- AEOI filing metadata ledger.
-- No account-holder names, TINs, balances or source spreadsheets belong here.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 200),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','preparer','reviewer','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.reporting_institutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_name text not null,
  jurisdiction char(2) not null,
  identifier_type text not null check (identifier_type in ('TAN','TIN','GIIN','UEN','OTHER')),
  identifier_value text not null,
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, jurisdiction, identifier_type, identifier_value)
);

create table if not exists public.filings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  institution_id uuid not null references public.reporting_institutions(id) on delete cascade,
  regime text not null check (regime in ('CRS','FATCA')),
  reporting_period_end date not null,
  schema_version text not null,
  filing_kind text not null check (filing_kind in ('new','correction','void','amended','nil')),
  message_ref_id text not null,
  status text not null default 'draft' check (status in ('draft','generated','submitted','accepted','accepted_with_errors','rejected','superseded')),
  xml_sha256 text,
  generated_at timestamptz,
  submitted_at timestamptz,
  authority_status_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, message_ref_id)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filing_id uuid not null references public.filings(id) on delete cascade,
  institution_id uuid not null references public.reporting_institutions(id) on delete cascade,
  regime text not null check (regime in ('CRS','FATCA')),
  record_kind text not null check (record_kind in ('ReportingFI','AccountReport','NilReport')),
  doc_ref_id text not null,
  corr_doc_ref_id text,
  parent_doc_ref_id text,
  business_key text not null,
  payload_digest text not null,
  record_state text not null check (record_state in ('pending','live','superseded','deleted','rejected')),
  superseded_by text,
  reporting_period_end date not null,
  schema_version text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, doc_ref_id)
);

create table if not exists public.authority_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filing_id uuid not null references public.filings(id) on delete cascade,
  authority text not null,
  overall_status text not null,
  response_ref text,
  response_sha256 text,
  parsed_errors jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reporting_institutions_org_idx on public.reporting_institutions (organization_id);
create index if not exists filings_org_period_idx on public.filings (organization_id, reporting_period_end desc);
create index if not exists filings_institution_idx on public.filings (institution_id, reporting_period_end desc);
create index if not exists ledger_org_business_idx on public.ledger_entries (organization_id, business_key, reporting_period_end);
create index if not exists ledger_parent_idx on public.ledger_entries (organization_id, parent_doc_ref_id);
create index if not exists authority_responses_filing_idx on public.authority_responses (filing_id, received_at desc);
create index if not exists audit_events_org_created_idx on public.audit_events (organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.reporting_institutions enable row level security;
alter table public.filings enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.authority_responses enable row level security;
alter table public.audit_events enable row level security;

-- Initial owner membership is created automatically and cannot be forged by the browser.
create or replace function public.aeoi_add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by <> auth.uid() then
    raise exception 'created_by must be the authenticated user';
  end if;
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

revoke all on function public.aeoi_add_owner_membership() from public, anon, authenticated;

drop trigger if exists aeoi_org_owner_membership on public.organizations;
create trigger aeoi_org_owner_membership
after insert on public.organizations
for each row execute function public.aeoi_add_owner_membership();

-- Organizations.
create policy "org select for members"
on public.organizations for select to authenticated
using (
  created_by = (select auth.uid())
  or id in (
    select organization_id
    from public.organization_members
    where user_id = (select auth.uid())
  )
);

create policy "org insert own"
on public.organizations for insert to authenticated
with check (created_by = (select auth.uid()));

create policy "org update owner"
on public.organizations for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

-- Memberships: every user can read their membership; owners manage the roster.
create policy "membership select own or org owner"
on public.organization_members for select to authenticated
using (
  user_id = (select auth.uid())
  or organization_id in (
    select id from public.organizations where created_by = (select auth.uid())
  )
);

create policy "membership insert by org owner"
on public.organization_members for insert to authenticated
with check (
  organization_id in (
    select id from public.organizations where created_by = (select auth.uid())
  )
);

create policy "membership update by org owner"
on public.organization_members for update to authenticated
using (
  organization_id in (
    select id from public.organizations where created_by = (select auth.uid())
  )
)
with check (
  organization_id in (
    select id from public.organizations where created_by = (select auth.uid())
  )
);

create policy "membership delete by org owner"
on public.organization_members for delete to authenticated
using (
  organization_id in (
    select id from public.organizations where created_by = (select auth.uid())
  )
  and role <> 'owner'
);

-- Tenant tables: authenticated members can read; preparer+ can write.
create policy "institution select members"
on public.reporting_institutions for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);

create policy "institution write preparers"
on public.reporting_institutions for insert to authenticated
with check (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer')
  )
);

create policy "institution update preparers"
on public.reporting_institutions for update to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer')
  )
)
with check (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer')
  )
);

create policy "filing select members"
on public.filings for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);

create policy "filing insert preparers"
on public.filings for insert to authenticated
with check (
  created_by = (select auth.uid())
  and organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer')
  )
);

create policy "filing update preparers"
on public.filings for update to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer','reviewer')
  )
)
with check (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer','reviewer')
  )
);

create policy "ledger select members"
on public.ledger_entries for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);

create policy "ledger insert preparers"
on public.ledger_entries for insert to authenticated
with check (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer')
  )
);

create policy "ledger update reviewers"
on public.ledger_entries for update to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer','reviewer')
  )
)
with check (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer','reviewer')
  )
);

create policy "authority select members"
on public.authority_responses for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);

create policy "authority insert preparers"
on public.authority_responses for insert to authenticated
with check (
  created_by = (select auth.uid())
  and organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin','preparer','reviewer')
  )
);

create policy "audit select admins"
on public.audit_events for select to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid()) and role in ('owner','admin')
  )
);

create policy "audit insert own"
on public.audit_events for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and organization_id in (
    select organization_id from public.organization_members
    where user_id = (select auth.uid())
  )
);

grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update on public.reporting_institutions to authenticated;
grant select, insert, update on public.filings to authenticated;
grant select, insert, update on public.ledger_entries to authenticated;
grant select, insert on public.authority_responses to authenticated;
grant select, insert on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

revoke all on public.organizations from anon;
revoke all on public.organization_members from anon;
revoke all on public.reporting_institutions from anon;
revoke all on public.filings from anon;
revoke all on public.ledger_entries from anon;
revoke all on public.authority_responses from anon;
revoke all on public.audit_events from anon;
