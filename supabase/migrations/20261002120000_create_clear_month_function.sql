-- "Limpiar todo" (budget-ui-polish-and-clear-all): wipes an entire month in
-- one irreversible, atomic action, confirmed explicitly by the user before
-- calling this. Every plan (card purchase, loan, recurring) that has at
-- least one occurrence in this month is removed completely -- past and
-- future occurrences included, not only this month's row -- since the user
-- confirmed that is the expected scope. Other expenses (no plan behind them)
-- are only removed for this month. The salary goes back to "not loaded"
-- (RF-01: null, never zero). The exchange rate is left untouched: it is
-- neither the salary nor an expense of the month.
create or replace function public.clear_month(p_year int, p_month int)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  delete from public.spending_plans
  where user_id = v_user_id
    and id in (
      select plan_id
      from public.expense_occurrences
      where user_id = v_user_id
        and year = p_year
        and month = p_month
    );

  delete from public.other_expenses
  where user_id = v_user_id
    and year = p_year
    and month = p_month;

  update public.monthly_budgets
  set salary_ars = null
  where user_id = v_user_id
    and year = p_year
    and month = p_month;
end;
$$;

revoke execute on function public.clear_month(int, int) from public;
grant execute on function public.clear_month(int, int) to authenticated;
