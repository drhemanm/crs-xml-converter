-- Atomic metadata commit for generated filings. Uses caller privileges/RLS.
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
      doc_ref_id, corr_doc_ref_id, parent_doc_ref_id, business_key,
      payload_digest, record_state, superseded_by, reporting_period_end,
      schema_version
    ) values (
      p_organization_id, v_filing_id, p_institution_id, p_regime,
      v_entry->>'record_kind',
      v_entry->>'doc_ref_id',
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

revoke all on function public.aeoi_record_filing(uuid,uuid,text,date,text,text,text,text,jsonb) from public, anon;
grant execute on function public.aeoi_record_filing(uuid,uuid,text,date,text,text,text,text,jsonb) to authenticated;
