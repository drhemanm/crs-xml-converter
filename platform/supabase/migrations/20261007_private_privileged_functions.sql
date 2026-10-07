create schema if not exists aeoi_private;
revoke all on schema aeoi_private from public, anon;
grant usage on schema aeoi_private to authenticated;

create or replace function aeoi_private.record_filing_internal(
  p_organization_id uuid, p_institution_id uuid, p_regime text,
  p_reporting_period_end date, p_schema_version text, p_filing_kind text,
  p_message_ref_id text, p_xml_sha256 text, p_entries jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_filing_id uuid;
  v_entry jsonb;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=v_user
      and m.role in ('owner','admin','preparer')
  ) then raise exception 'Insufficient workspace role'; end if;
  if not exists (
    select 1 from public.reporting_institutions ri
    where ri.id=p_institution_id and ri.organization_id=p_organization_id and ri.active=true
  ) then raise exception 'Reporting institution does not belong to this organization'; end if;
  if p_regime not in ('CRS','FATCA') then raise exception 'Unsupported reporting regime'; end if;
  if p_filing_kind not in ('new','correction','void','amended','nil') then raise exception 'Unsupported filing kind'; end if;
  if p_message_ref_id is null or length(trim(p_message_ref_id))<1 then raise exception 'MessageRefId is required'; end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)<1 or jsonb_array_length(p_entries)>250000
  then raise exception 'Filing entries must contain between 1 and 250000 records'; end if;

  insert into public.filings (
    organization_id,institution_id,regime,reporting_period_end,schema_version,
    filing_kind,message_ref_id,status,xml_sha256,generated_at,created_by
  ) values (
    p_organization_id,p_institution_id,p_regime,p_reporting_period_end,p_schema_version,
    p_filing_kind,trim(p_message_ref_id),'generated',p_xml_sha256,now(),v_user
  ) returning id into v_filing_id;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    if coalesce(v_entry->>'doc_ref_id','')='' or coalesce(v_entry->>'doc_type_indic','')=''
       or coalesce(v_entry->>'business_key','')='' or coalesce(v_entry->>'payload_digest','')=''
    then raise exception 'Ledger entry is missing required immutable metadata'; end if;

    insert into public.ledger_entries (
      organization_id,filing_id,institution_id,regime,record_kind,doc_ref_id,
      doc_type_indic,corr_doc_ref_id,parent_doc_ref_id,business_key,payload_digest,
      record_state,superseded_by,reporting_period_end,schema_version
    ) values (
      p_organization_id,v_filing_id,p_institution_id,p_regime,v_entry->>'record_kind',
      v_entry->>'doc_ref_id',v_entry->>'doc_type_indic',nullif(v_entry->>'corr_doc_ref_id',''),
      nullif(v_entry->>'parent_doc_ref_id',''),v_entry->>'business_key',v_entry->>'payload_digest',
      v_entry->>'record_state',nullif(v_entry->>'superseded_by',''),p_reporting_period_end,p_schema_version
    );
  end loop;

  insert into public.audit_events (
    organization_id,actor_user_id,event_type,entity_type,entity_id,metadata
  ) values (
    p_organization_id,v_user,'filing.generated','filing',v_filing_id,
    jsonb_build_object('regime',p_regime,'message_ref_id',p_message_ref_id)
  );
  return v_filing_id;
end;
$$;

revoke all on function aeoi_private.record_filing_internal(uuid,uuid,text,date,text,text,text,text,jsonb) from public, anon;
grant execute on function aeoi_private.record_filing_internal(uuid,uuid,text,date,text,text,text,text,jsonb) to authenticated;

create or replace function aeoi_private.apply_authority_status_internal(
  p_organization_id uuid,p_filing_id uuid,p_authority text,p_overall_status text,
  p_response_ref text,p_response_sha256 text,p_parsed_errors jsonb,p_updates jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_update jsonb;
  v_status text;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=v_user
      and m.role in ('owner','admin','preparer','reviewer')
  ) then raise exception 'Insufficient workspace role'; end if;
  if not exists (
    select 1 from public.filings f where f.id=p_filing_id and f.organization_id=p_organization_id
  ) then raise exception 'Filing does not belong to this organization'; end if;
  if jsonb_typeof(p_updates)<>'array' or jsonb_array_length(p_updates)>250000
  then raise exception 'Invalid status update set'; end if;

  for v_update in select * from jsonb_array_elements(p_updates)
  loop
    update public.ledger_entries
    set record_state=v_update->>'record_state', superseded_by=nullif(v_update->>'superseded_by','')
    where organization_id=p_organization_id and filing_id=p_filing_id
      and doc_ref_id=v_update->>'doc_ref_id';
    if not found then raise exception 'Status update references a record outside the filing'; end if;
  end loop;

  v_status := case
    when lower(p_overall_status) like '%reject%' then 'rejected'
    when jsonb_array_length(coalesce(p_parsed_errors,'[]'::jsonb))>0 then 'accepted_with_errors'
    else 'accepted'
  end;

  update public.filings set status=v_status,authority_status_at=now()
  where id=p_filing_id and organization_id=p_organization_id;

  insert into public.authority_responses (
    organization_id,filing_id,authority,overall_status,response_ref,response_sha256,
    parsed_errors,created_by
  ) values (
    p_organization_id,p_filing_id,p_authority,p_overall_status,nullif(p_response_ref,''),
    nullif(p_response_sha256,''),coalesce(p_parsed_errors,'[]'::jsonb),v_user
  );

  insert into public.audit_events (
    organization_id,actor_user_id,event_type,entity_type,entity_id,metadata
  ) values (
    p_organization_id,v_user,'authority.status_applied','filing',p_filing_id,
    jsonb_build_object('authority',p_authority,'status',p_overall_status)
  );
end;
$$;

revoke all on function aeoi_private.apply_authority_status_internal(uuid,uuid,text,text,text,text,jsonb,jsonb) from public, anon;
grant execute on function aeoi_private.apply_authority_status_internal(uuid,uuid,text,text,text,text,jsonb,jsonb) to authenticated;

create or replace function public.aeoi_record_filing(
  p_organization_id uuid,p_institution_id uuid,p_regime text,p_reporting_period_end date,
  p_schema_version text,p_filing_kind text,p_message_ref_id text,p_xml_sha256 text,p_entries jsonb
) returns uuid
language sql security invoker set search_path = ''
as $$
  select aeoi_private.record_filing_internal(
    p_organization_id,p_institution_id,p_regime,p_reporting_period_end,p_schema_version,
    p_filing_kind,p_message_ref_id,p_xml_sha256,p_entries
  );
$$;

create or replace function public.aeoi_apply_authority_status(
  p_organization_id uuid,p_filing_id uuid,p_authority text,p_overall_status text,
  p_response_ref text,p_response_sha256 text,p_parsed_errors jsonb,p_updates jsonb
) returns void
language sql security invoker set search_path = ''
as $$
  select aeoi_private.apply_authority_status_internal(
    p_organization_id,p_filing_id,p_authority,p_overall_status,p_response_ref,
    p_response_sha256,p_parsed_errors,p_updates
  );
$$;

revoke all on function public.aeoi_record_filing(uuid,uuid,text,date,text,text,text,text,jsonb) from public, anon;
revoke all on function public.aeoi_apply_authority_status(uuid,uuid,text,text,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.aeoi_record_filing(uuid,uuid,text,date,text,text,text,text,jsonb) to authenticated;
grant execute on function public.aeoi_apply_authority_status(uuid,uuid,text,text,text,text,jsonb,jsonb) to authenticated;
