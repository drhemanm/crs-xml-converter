-- Security/performance hardening discovered by Supabase advisors.

alter table public.email_subscribers enable row level security;
revoke all on public.email_subscribers from anon, authenticated;
grant insert on public.email_subscribers to anon;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists filings_created_by_idx on public.filings(created_by);
create index if not exists ledger_filing_idx on public.ledger_entries(filing_id);
create index if not exists ledger_institution_idx on public.ledger_entries(institution_id);
create index if not exists authority_responses_org_idx on public.authority_responses(organization_id);
create index if not exists authority_responses_created_by_idx on public.authority_responses(created_by);
create index if not exists audit_events_actor_idx on public.audit_events(actor_user_id);
