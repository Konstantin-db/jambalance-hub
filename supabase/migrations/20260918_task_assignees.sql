BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.tasks
SET assignee_ids = ARRAY[assigned_to]
WHERE assigned_to IS NOT NULL AND cardinality(assignee_ids) = 0;

-- Keep the existing single-assignee field compatible with older open pages.
CREATE OR REPLACE FUNCTION public.sync_task_assignees()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF cardinality(NEW.assignee_ids) = 0 AND NEW.assigned_to IS NOT NULL THEN
      NEW.assignee_ids := ARRAY[NEW.assigned_to];
    END IF;
  ELSIF NEW.assignee_ids IS NOT DISTINCT FROM OLD.assignee_ids
    AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    NEW.assignee_ids := array_remove(OLD.assignee_ids, OLD.assigned_to);
    IF NEW.assigned_to IS NOT NULL THEN
      NEW.assignee_ids := ARRAY[NEW.assigned_to] || array_remove(NEW.assignee_ids, NEW.assigned_to);
    END IF;
  END IF;
  NEW.assignee_ids := ARRAY(
    SELECT id FROM unnest(NEW.assignee_ids) WITH ORDINALITY AS a(id, n)
    WHERE id IS NOT NULL GROUP BY id ORDER BY min(n)
  );
  NEW.assigned_to := NEW.assignee_ids[1];
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_sync_assignees ON public.tasks;
CREATE TRIGGER tasks_sync_assignees
BEFORE INSERT OR UPDATE OF assigned_to, assignee_ids ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_assignees();

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT count(*) AS tasks_total,
       count(*) FILTER (WHERE assigned_to IS NOT NULL AND assigned_to = ANY(assignee_ids)) AS tasks_with_preserved_assignee
FROM public.tasks;
