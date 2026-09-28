-- Atomic card-purchase creation/edit: a purchase and every remaining monthly
-- occurrence it generates must land together, never as an orphaned plan with
-- no rows (or vice versa) if a client retries mid-way (AGENTS.md §8).

create or replace function public.create_card_purchase(
  p_concept text,
  p_card text,
  p_currency text,
  p_quota_amount numeric,
  p_starting_installment int,
  p_total_installments int,
  p_year int,
  p_month int
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_offset int;
  v_target_date date;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_starting_installment < 1 or p_starting_installment > p_total_installments then
    raise exception 'starting installment must be between 1 and the total installments';
  end if;

  insert into public.spending_plans (
    user_id, kind, concept, group_label, currency, total_installments, default_amount
  ) values (
    v_user_id, 'card_purchase', p_concept, p_card, p_currency, p_total_installments, p_quota_amount
  )
  returning id into v_plan_id;

  for v_offset in 0 .. (p_total_installments - p_starting_installment) loop
    v_target_date := make_date(p_year, p_month, 1) + (v_offset || ' months')::interval;

    insert into public.expense_occurrences (
      user_id, plan_id, year, month, installment_number, amount, amount_is_estimated
    ) values (
      v_user_id,
      v_plan_id,
      extract(year from v_target_date)::int,
      extract(month from v_target_date)::int,
      p_starting_installment + v_offset,
      p_quota_amount,
      false
    );
  end loop;

  return v_plan_id;
end;
$$;

-- Edits apply "desde este mes" (RF-08 / FUNCTIONALITY.md P-04, resolved for
-- card purchases in v1.1): every occurrence at or after (p_from_year,
-- p_from_month) is replaced with the corrected amount/total; earlier months
-- are never touched, so history stays intact.
create or replace function public.update_card_purchase(
  p_plan_id uuid,
  p_concept text,
  p_card text,
  p_currency text,
  p_quota_amount numeric,
  p_from_installment int,
  p_from_year int,
  p_from_month int,
  p_total_installments int
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_offset int;
  v_target_date date;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_from_installment < 1 or p_from_installment > p_total_installments then
    raise exception 'the edited installment must stay between 1 and the new total installments';
  end if;

  update public.spending_plans
  set concept = p_concept,
      group_label = p_card,
      currency = p_currency,
      default_amount = p_quota_amount,
      total_installments = p_total_installments
  where id = p_plan_id and user_id = v_user_id;

  if not found then
    raise exception 'card purchase plan not found';
  end if;

  delete from public.expense_occurrences
  where plan_id = p_plan_id
    and user_id = v_user_id
    and (year, month) >= (p_from_year, p_from_month);

  for v_offset in 0 .. (p_total_installments - p_from_installment) loop
    v_target_date := make_date(p_from_year, p_from_month, 1) + (v_offset || ' months')::interval;

    insert into public.expense_occurrences (
      user_id, plan_id, year, month, installment_number, amount, amount_is_estimated
    ) values (
      v_user_id,
      p_plan_id,
      extract(year from v_target_date)::int,
      extract(month from v_target_date)::int,
      p_from_installment + v_offset,
      p_quota_amount,
      false
    );
  end loop;
end;
$$;

revoke execute on function public.create_card_purchase(
  text, text, text, numeric, int, int, int, int
) from public;
grant execute on function public.create_card_purchase(
  text, text, text, numeric, int, int, int, int
) to authenticated;

revoke execute on function public.update_card_purchase(
  uuid, text, text, text, numeric, int, int, int, int
) from public;
grant execute on function public.update_card_purchase(
  uuid, text, text, text, numeric, int, int, int, int
) to authenticated;
