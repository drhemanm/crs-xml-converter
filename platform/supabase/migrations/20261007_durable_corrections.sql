-- Complete durable filing metadata required to reconstruct correction chains.

alter table public.ledger_entries
  add column if not exists doc_type_indic text;

update public.ledger_entries
set doc_type_indic = case
  when regime = 'CRS' and record_kind = 'ReportingFI' then 'OECD0'
  when regime = 'CRS' and record_state = 'pending' then 'OECD1'
  when regime = 'FATCA' then 'FATCA1'
  else 'UNKNOWN'
end
where doc_type_indic is null;

alter table public.ledger_entries
  alter column doc_type_indic set not null;

create or replace function public.aeoi_record_filing(
  p_organization_id uuid,
  p_institution_id uuid,
  p_regime text,
  p_reporting_period_end date,
  p_schema_version text,
  p_filing_kind text,
  p_message_ref_id text,
  p_xml_sha256 text,
  p_entries jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_filing_id uuid;
  v_entry jsonb;
begin
  insert into public.filings (
    organization_id, institution_id, regime, reporting_period_end,
    schema_version, filing_kind, message_ref_id, status,
    xml_sha256, generated_at, created_by
  ) values (
    p_organization_id, p_institution_id, p_regime, p_reporting_period_end,
    p_schema_version, p_filing_kind, p_message_ref_id, 'generated',
    p_xml_sha256, now(), auth.uid()
  )
  returning id into v_filing_id;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into public.ledger_entries (
      organization_id, filing_id, institution_id, regime, record_kind,
      doc_ref_id, doc_type_indic, corr_doc_ref_id, parent_doc_ref_id,
      business_key, payload_digest, record_state, superseded_by,
      reporting_period_end, schema_version
    ) values (
      p_organization_id, v_filing_id, p_institution_id, p_regime,
      v_entry->>'record_kind',
      v_entry->>'doc_ref_id',
      v_entry->>'doc_type_indic',
      nullif(v_entry->>'corr_doc_ref_id',''),
      nullif(v_entry->>'parent_doc_ref_id',''),
      v_entry->>'business_key',
      v_entry->>'payload_digest',
      v_entry->>'record_state',
      nullif(v_entry->>'superseded_by',''),
      p_reporting_period_end,
      p_schema_version
    );
  end loop;

  insert into public.audit_events (
    organization_id, actor_user_id, event_type, entity_type, entity_id, metadata
  ) values (
    p_organization_id, auth.uid(), 'filing.generated', 'filing', v_filing_id,
    jsonb_build_object('regime', p_regime, 'message_ref_id', p_message_ref_id)
  );

  return v_filing_id;
end;
$$;

create or replace function public.aeoi_apply_authority_status(
  p_organization_id uuid,
  p_filing_id uuid,
  p_authority text,
  p_overall_status text,
  p_response_ref text,
  p_response_sha256 text,
  p_parsed_errors jsonb,
  p_updates jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_update jsonb;
  v_status text;
begin
  for v_update in select * from jsonb_array_elements(p_updates)
  loop
    update public.ledger_entries
    set
      record_state = v_update->>'record_state',
      superseded_by = nullif(v_update->>'superseded_by','')
    where organization_id = p_organization_id
      and doc_ref_id = v_update->>'doc_ref_id';
  end loop;

  v_status := case
    when lower(p_overall_status) like '%reject%' then 'rejected'
    when jsonb_array_length(coalesce(p_parsed_errors, '[]'::jsonb)) > 0 then 'accepted_with_errors'
    else 'accepted'
  end;

  update public.filings
  set status = v_status, authority_status_at = now()
  where id = p_filing_id and organization_id = p_organization_id;

  insert into public.authority_responses (
    organization_id, filing_id, authority, overall_status, response_ref,
    response_sha256, parsed_errors, created_by
  ) values (
    p_organization_id, p_filing_id, p_authority, p_overall_status,
    nullif(p_response_ref,''), nullif(p_response_sha256,''),
    coalesce(p_parsed_errors,'[]'::jsonb), auth.uid()
  );

  insert into public.audit_events (
    organization_id, actor_user_id, event_type, entity_type, entity_id, metadata
  ) values (
    p_organization_id, auth.uid(), 'authority.status_applied', 'filing', p_filing_id,
    jsonb_build_object('authority', p_authority, 'status', p_overall_status)
  );
end;
$$;

revoke all on function public.aeoi_apply_authority_status(uuid,uuid,text,text,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.aeoi_apply_authority_status(uuid,uuid,text,text,text,text,jsonb,jsonb) to authenticated;
