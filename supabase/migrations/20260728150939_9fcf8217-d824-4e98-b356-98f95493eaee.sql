CREATE TABLE public.admin_login_attempts (
  ip text PRIMARY KEY,
  fail_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_login_attempts TO service_role;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ip_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ip_bans TO service_role;
ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_admin_login_attempts_updated_at
BEFORE UPDATE ON public.admin_login_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ip_bans_updated_at
BEFORE UPDATE ON public.ip_bans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();