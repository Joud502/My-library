create or replace function public.admin_exec_sql(query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  affected bigint;
  head text := lower(regexp_replace(btrim(query), '\s.*$', ''));
begin
  if head in ('select','with','table','show','explain','values') then
    execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (' || query || ') t' into result;
    return jsonb_build_object('kind', 'rows', 'rows', result);
  else
    execute query;
    get diagnostics affected = row_count;
    return jsonb_build_object('kind', 'command', 'command', head, 'rows_affected', affected);
  end if;
end;
$$;

revoke all on function public.admin_exec_sql(text) from public;
revoke all on function public.admin_exec_sql(text) from anon;
revoke all on function public.admin_exec_sql(text) from authenticated;
grant execute on function public.admin_exec_sql(text) to service_role;