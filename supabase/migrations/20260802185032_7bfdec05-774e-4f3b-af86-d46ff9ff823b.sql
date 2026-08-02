ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_chat boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (is_public = true);

DROP POLICY IF EXISTS "Books of public profiles are viewable by everyone" ON public.books;
CREATE POLICY "Books of public profiles are viewable by everyone"
ON public.books FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = books.user_id AND p.is_public = true));

DROP POLICY IF EXISTS "Series of public profiles are viewable by everyone" ON public.series;
CREATE POLICY "Series of public profiles are viewable by everyone"
ON public.series FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = series.user_id AND p.is_public = true));

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.books TO anon;
GRANT SELECT ON public.series TO anon;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own conversations"
ON public.messages FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Members send messages to members who allow chat"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> recipient_id
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = recipient_id AND p.allow_chat = true)
);

CREATE POLICY "Recipients update their received messages"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Senders delete their own messages"
ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS messages_pair_idx ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON public.messages (recipient_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;