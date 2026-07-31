ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, birth_date)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NULLIF(NEW.raw_user_meta_data ->> 'birth_date', '')::date
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS cover_blocked boolean NOT NULL DEFAULT false;