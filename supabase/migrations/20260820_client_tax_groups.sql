begin;

create table if not exists public.client_groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint client_groups_name_not_blank
    check (length(btrim(group_name)) > 0)
);

create unique index if not exists client_groups_group_name_lower_uidx
  on public.client_groups (lower(btrim(group_name)));

alter table public.clients
  add column if not exists edo_identifier text;

alter table public.clients
  add column if not exists client_group_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_client_group_id_fkey'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_client_group_id_fkey
      foreign key (client_group_id)
      references public.client_groups(id)
      on delete set null;
  end if;
end
$$;

create index if not exists clients_client_group_id_idx
  on public.clients (client_group_id);

create table if not exists public.client_tax_systems (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null
    references public.clients(id) on delete cascade,
  tax_system text not null,
  rate_code text not null default '',
  custom_rate text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint client_tax_systems_name_not_blank
    check (length(btrim(tax_system)) > 0),
  constraint client_tax_systems_rate_code_check
    check (rate_code in ('', '5', '6', '7', '10', '12', '15', '20', '22', 'other')),
  constraint client_tax_systems_custom_rate_check
    check (
      (rate_code = 'other' and length(btrim(coalesce(custom_rate, ''))) > 0)
      or
      (rate_code <> 'other' and custom_rate is null)
    )
);

create index if not exists client_tax_systems_client_id_idx
  on public.client_tax_systems (client_id, sort_order, created_at);

insert into public.client_tax_systems (
  client_id,
  tax_system,
  rate_code,
  sort_order,
  created_by,
  updated_by
)
select
  c.id,
  btrim(c.tax_system),
  '',
  0,
  c.created_by,
  c.updated_by
from public.clients c
where nullif(btrim(c.tax_system), '') is not null
  and not exists (
    select 1
    from public.client_tax_systems cts
    where cts.client_id = c.id
  );

alter table public.client_groups enable row level security;
alter table public.client_tax_systems enable row level security;

drop policy if exists "Authenticated users can read client groups"
  on public.client_groups;
create policy "Authenticated users can read client groups"
  on public.client_groups
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create client groups"
  on public.client_groups;
create policy "Authenticated users can create client groups"
  on public.client_groups
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update client groups"
  on public.client_groups;
create policy "Authenticated users can update client groups"
  on public.client_groups
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete client groups"
  on public.client_groups;
create policy "Authenticated users can delete client groups"
  on public.client_groups
  for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read client tax systems"
  on public.client_tax_systems;
create policy "Authenticated users can read client tax systems"
  on public.client_tax_systems
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create client tax systems"
  on public.client_tax_systems;
create policy "Authenticated users can create client tax systems"
  on public.client_tax_systems
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update client tax systems"
  on public.client_tax_systems;
create policy "Authenticated users can update client tax systems"
  on public.client_tax_systems
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete client tax systems"
  on public.client_tax_systems;
create policy "Authenticated users can delete client tax systems"
  on public.client_tax_systems
  for delete
  to authenticated
  using (true);

grant select, insert, update, delete
  on public.client_groups
  to authenticated;

grant select, insert, update, delete
  on public.client_tax_systems
  to authenticated;

comment on column public.clients.edo_identifier is
  'Идентификатор участника ЭДО клиента.';

comment on column public.clients.client_group_id is
  'Именованная группа связанных клиентов.';

comment on table public.client_tax_systems is
  'Налоговые системы клиента и индивидуальная ставка для каждой системы.';

commit;
