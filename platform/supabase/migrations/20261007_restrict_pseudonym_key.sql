-- Restrict per-FI pseudonym key to filing roles.
revoke select, insert, update, delete on public.reporting_institutions from authenticated;

grant select (
  id, organization_id, legal_name, jurisdiction, identifier_type,
  identifier_value, city, active, created_at
) on public.reporting_institutions to authenticated;

grant insert (
  organization_id, legal_name, jurisdiction, identifier_type,
  identifier_value, city, active
) on public.reporting_institutions to authenticated;

create or replace function aeoi_private.get_pseudonym_key_internal(p_institution_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_key text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select ri.pseudonym_key into v_key
  from public.reporting_institutions ri
  join public.organization_members m
    on m.organization_id=ri.organization_id
   and m.user_id=v_user
   and m.role in ('owner','admin','preparer')
  where ri.id=p_institution_id and ri.active=true;
  if v_key is null then raise exception 'Insufficient workspace role or unknown institution'; end if;
  return v_key;
end;
$$;

revoke all on function aeoi_private.get_pseudonym_key_internal(uuid) from public, anon;
grant execute on function aeoi_private.get_pseudonym_key_internal(uuid) to authenticated;

create or replace function public.aeoi_get_pseudonym_key(p_institution_id uuid)
returns text
language sql security invoker set search_path = ''
as $$
  select aeoi_private.get_pseudonym_key_internal(p_institution_id);
$$;

revoke all on function public.aeoi_get_pseudonym_key(uuid) from public, anon;
grant execute on function public.aeoi_get_pseudonym_key(uuid) to authenticated;
