CREATE TABLE public.banned_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX banned_emails_email_key ON public.banned_emails (lower(email));

GRANT ALL ON public.banned_emails TO service_role;

ALTER TABLE public.banned_emails ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_banned_emails_updated_at
BEFORE UPDATE ON public.banned_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();