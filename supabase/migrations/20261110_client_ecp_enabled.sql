ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ecp_enabled boolean;

UPDATE public.clients
SET ecp_enabled = (ecp_expires_at IS NOT NULL)
WHERE ecp_enabled IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN ecp_enabled SET DEFAULT false,
  ALTER COLUMN ecp_enabled SET NOT NULL;
