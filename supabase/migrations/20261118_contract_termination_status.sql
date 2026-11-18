begin;

alter table public.client_documents
  add column if not exists termination_applied_at timestamptz;

create or replace function public.apply_due_client_terminations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  applied_count integer := 0;
begin
  for item in
    select id, client_id
    from public.client_documents
    where doc_type = 'agreement-termination'
      and client_id is not null
      and end_date <= current_date
      and termination_applied_at is null
    for update skip locked
  loop
    update public.clients
    set status = 'inactive'
    where id = item.client_id;

    update public.client_documents
    set termination_applied_at = now(),
        updated_at = now()
    where id = item.id
      and termination_applied_at is null;

    applied_count := applied_count + 1;
  end loop;

  return applied_count;
end;
$$;

revoke all on function public.apply_due_client_terminations() from public, anon, authenticated;
grant execute on function public.apply_due_client_terminations() to postgres;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'apply-client-termination-statuses'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'apply-client-termination-statuses',
    '5 * * * *',
    'select public.apply_due_client_terminations()'
  );
end;
$$;

create or replace function public.apply_client_termination_on_document_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $
begin
  if new.doc_type = 'agreement-termination'
     and new.client_id is not null
     and new.end_date <= current_date
     and new.termination_applied_at is null then
    update public.clients
    set status = 'inactive'
    where id = new.client_id;

    new.termination_applied_at := now();
  end if;
  return new;
end;
$;

revoke all on function public.apply_client_termination_on_document_save() from public, anon, authenticated;
grant execute on function public.apply_client_termination_on_document_save() to postgres;

drop trigger if exists client_documents_apply_termination_status on public.client_documents;
create trigger client_documents_apply_termination_status
before insert or update of doc_type, client_id, end_date
on public.client_documents
for each row execute function public.apply_client_termination_on_document_save();

select public.apply_due_client_terminations();

commit;
