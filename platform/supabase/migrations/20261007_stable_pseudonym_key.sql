alter table public.reporting_institutions
  add column if not exists pseudonym_key text;

update public.reporting_institutions
set pseudonym_key = encode(gen_random_bytes(32), 'base64')
where pseudonym_key is null;

alter table public.reporting_institutions
  alter column pseudonym_key set default encode(gen_random_bytes(32), 'base64'),
  alter column pseudonym_key set not null;
