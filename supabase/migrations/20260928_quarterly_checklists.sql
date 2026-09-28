begin;

create table public.quarterly_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index quarterly_templates_name_unique on public.quarterly_templates (lower(btrim(name)));

create table public.quarterly_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quarterly_templates(id) on delete cascade,
  parent_id uuid references public.quarterly_template_items(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index quarterly_template_items_order on public.quarterly_template_items(template_id, sort_order, created_at);

create table public.quarterly_checklists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  quarter integer not null check (quarter between 1 and 4),
  template_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(client_id, year, quarter)
);

create table public.quarterly_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.quarterly_checklists(id) on delete cascade,
  parent_id uuid references public.quarterly_checklist_items(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  sort_order integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (parent_id is distinct from id),
  check ((completed_at is null) = (completed_by is null))
);
create index quarterly_checklist_items_order on public.quarterly_checklist_items(checklist_id, sort_order, created_at);

-- Prevent an item from being attached to a parent in another template/checklist,
-- and keep the hierarchy to one level for the two-level checklist interface.
create function public.validate_quarterly_item_parent() returns trigger language plpgsql
set search_path = public as $$
declare parent_owner uuid; parent_parent uuid;
begin
  if new.parent_id is null then return new; end if;
  if tg_table_name = 'quarterly_template_items' then
    select template_id, parent_id into parent_owner, parent_parent
    from public.quarterly_template_items where id = new.parent_id;
    if parent_owner is distinct from new.template_id or parent_parent is not null then
      raise exception 'Invalid template item parent';
    end if;
  else
    select checklist_id, parent_id into parent_owner, parent_parent
    from public.quarterly_checklist_items where id = new.parent_id;
    if parent_owner is distinct from new.checklist_id or parent_parent is not null then
      raise exception 'Invalid checklist item parent';
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_quarterly_template_parent before insert or update of parent_id, template_id
on public.quarterly_template_items for each row execute function public.validate_quarterly_item_parent();
create trigger validate_quarterly_checklist_parent before insert or update of parent_id, checklist_id
on public.quarterly_checklist_items for each row execute function public.validate_quarterly_item_parent();

do $$ declare tab text; begin
  foreach tab in array array['quarterly_templates','quarterly_template_items','quarterly_checklists','quarterly_checklist_items'] loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('create policy "active staff read" on public.%I for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true))', tab);
    execute format('create policy "active staff add" on public.%I for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true))', tab);
    execute format('create policy "active staff edit" on public.%I for update to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true)) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true))', tab);
    execute format('create policy "active staff remove" on public.%I for delete to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true))', tab);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tab);
  end loop;
end $$;

create function public.create_quarterly_checklist(p_client_id uuid, p_year integer, p_quarter integer, p_template_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_parent record; v_new_parent uuid; v_name text;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and is_active = true) then
    raise exception 'Active staff account required';
  end if;
  if not exists(select 1 from public.clients where id = p_client_id and status = 'active') then
    raise exception 'Active client required';
  end if;
  select name into v_name from public.quarterly_templates where id = p_template_id;
  if v_name is null then raise exception 'Template not found'; end if;
  insert into public.quarterly_checklists(client_id, year, quarter, template_name, created_by)
  values(p_client_id, p_year, p_quarter, v_name, auth.uid()) returning id into v_id;
  for v_parent in select * from public.quarterly_template_items
    where template_id = p_template_id and parent_id is null order by sort_order, created_at, id loop
    insert into public.quarterly_checklist_items(checklist_id, title, sort_order)
    values(v_id, v_parent.title, v_parent.sort_order) returning id into v_new_parent;
    insert into public.quarterly_checklist_items(checklist_id, parent_id, title, sort_order)
    select v_id, v_new_parent, title, sort_order from public.quarterly_template_items
    where parent_id = v_parent.id order by sort_order, created_at, id;
  end loop;
  return v_id;
end;
$$;
revoke all on function public.create_quarterly_checklist(uuid,integer,integer,uuid) from public;
grant execute on function public.create_quarterly_checklist(uuid,integer,integer,uuid) to authenticated;

-- Starter lists can be edited freely before or after using them.
insert into public.quarterly_templates(name) values
  ('ИП без сотрудников'), ('ИП с сотрудниками'), ('ООО с НДС');
insert into public.quarterly_template_items(template_id, title, sort_order)
select t.id, v.title, v.pos from public.quarterly_templates t
cross join (values (1, 'Сверка остатков по банкам'), (2, 'Обработка первичных документов'),
 (3, 'Закрытие отчётного периода'), (4, 'Проверка и сдача отчётности')) as v(pos,title);
insert into public.quarterly_template_items(template_id, parent_id, title, sort_order)
select t.id, p.id, v.title, v.pos from public.quarterly_templates t
join public.quarterly_template_items p on p.template_id=t.id and p.title='Проверка и сдача отчётности'
join (values ('ИП с сотрудниками',1,'6-НДФЛ'),('ИП с сотрудниками',2,'РСВ'),
 ('ИП с сотрудниками',3,'ЕФС-1'),('ООО с НДС',1,'Декларация по НДС')) as v(template_name,pos,title)
 on v.template_name=t.name;

notify pgrst, 'reload schema';
commit;
