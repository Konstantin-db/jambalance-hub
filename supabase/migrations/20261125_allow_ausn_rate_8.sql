begin;

alter table public.client_tax_systems
  drop constraint if exists client_tax_systems_rate_code_check;

alter table public.client_tax_systems
  add constraint client_tax_systems_rate_code_check
  check (rate_code in ('', '5', '6', '7', '8', '10', '12', '15', '20', '22', 'other'));

commit;
