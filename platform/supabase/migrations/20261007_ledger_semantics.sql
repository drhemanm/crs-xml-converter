alter table public.ledger_entries
  add column if not exists jurisdiction char(2);

update public.ledger_entries le
set jurisdiction = ri.jurisdiction
from public.reporting_institutions ri
where le.institution_id = ri.id and le.jurisdiction is null;

alter table public.ledger_entries
  alter column jurisdiction set not null;

create or replace function public.aeoi_fill_ledger_jurisdiction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.jurisdiction is null then
    select jurisdiction into new.jurisdiction
    from public.reporting_institutions
    where id = new.institution_id and organization_id = new.organization_id;
  end if;
  if new.jurisdiction is null then
    raise exception 'Reporting institution jurisdiction is required';
  end if;
  return new;
end;
$$;

revoke all on function public.aeoi_fill_ledger_jurisdiction() from public, anon, authenticated;

drop trigger if exists aeoi_fill_ledger_jurisdiction on public.ledger_entries;
create trigger aeoi_fill_ledger_jurisdiction
before insert on public.ledger_entries
for each row execute function public.aeoi_fill_ledger_jurisdiction();
