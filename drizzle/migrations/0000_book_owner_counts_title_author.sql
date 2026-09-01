create or replace function public.unaccent_safe(txt text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(
    coalesce(txt, ''),
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
  )
$$;

create or replace function public.book_norm(txt text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(lower(public.unaccent_safe(txt)), '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function public.book_owner_counts()
returns table (title_key text, owners bigint)
language sql
stable
security definer
set search_path = public
as $$
  select public.book_norm(b.title) || '|' || public.book_norm(b.author) as title_key,
         count(distinct b.user_id) as owners
  from public.books b
  group by 1
$$;

grant execute on function public.book_owner_counts() to authenticated;
grant execute on function public.book_norm(text) to authenticated;
grant execute on function public.unaccent_safe(text) to authenticated;