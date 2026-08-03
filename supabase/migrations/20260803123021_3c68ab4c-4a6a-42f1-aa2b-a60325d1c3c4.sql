CREATE POLICY "Members who allow chat are discoverable"
ON public.profiles
FOR SELECT
TO authenticated
USING (allow_chat = true);