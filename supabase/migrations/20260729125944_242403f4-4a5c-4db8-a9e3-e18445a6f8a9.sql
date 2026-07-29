CREATE TABLE public.admin_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  detail text,
  target_email text,
  target_id text,
  ip text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_logs TO service_role;

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX admin_logs_created_at_idx ON public.admin_logs (created_at DESC);