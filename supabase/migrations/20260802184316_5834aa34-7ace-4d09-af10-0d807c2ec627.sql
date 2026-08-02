revoke execute on function public.book_owner_counts() from public;
revoke execute on function public.book_owner_counts() from anon;
grant execute on function public.book_owner_counts() to authenticated;