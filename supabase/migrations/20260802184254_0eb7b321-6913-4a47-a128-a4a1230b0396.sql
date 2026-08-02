create or replace function public.book_owner_counts()
returns table(title_key text, owners bigint)
language sql
stable
security definer
set search_path = public
as $$
  select lower(btrim(b.title)) as title_key, count(distinct b.user_id) as owners
  from public.books b
  where lower(btrim(b.title)) in (
    select lower(btrim(t.title)) from public.books t where t.user_id = auth.uid()
  )
  group by 1
$$;

grant execute on function public.book_owner_counts() to authenticated;