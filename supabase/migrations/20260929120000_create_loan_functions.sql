-- Loans (RF-03) differ from card purchases in one decisive way: every
-- installment carries its own amount, known only when the statement arrives.
-- So the plan keeps default_amount null (loans_have_no_default_amount) and the
-- occurrences are created with amount null until the user completes them.

create or replace function public.create_loan(
  p_concept text,
  p_entity text,
  p_starting_installment int,
  p_total_installments int,
  p_year int,
  p_month int,
  p_quota_amount numeric
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

  if p_quota_amount is null or p_quota_amount <= 0 then
    raise exception 'the installment amount must be greater than zero';
  end if;

  insert into public.spending_plans (
    user_id, kind, concept, group_label, currency, total_installments, default_amount
  ) values (
    v_user_id, 'loan', p_concept, p_entity, 'ars', p_total_installments, null
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
      -- Only the installment the user is loading has a known amount; the rest
      -- show "Falta completar importe" instead of copying this one (RF-03).
      case when v_offset = 0 then p_quota_amount else null end,
      false
    );
  end loop;

  return v_plan_id;
end;
$$;

-- Edits apply "desde este mes" (RF-08 / FUNCTIONALITY.md P-04), but for loans
-- that rule only reschedules month and installment number: an amount already
-- entered for another installment is never overwritten, so the tail rows are
-- updated in place instead of being deleted and inserted again.
create or replace function public.update_loan(
  p_plan_id uuid,
  p_concept text,
  p_entity text,
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
  v_occurrence record;
  v_index int := 0;
  v_target_count int := p_total_installments - p_from_installment + 1;
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
      group_label = p_entity,
      total_installments = p_total_installments
  where id = p_plan_id and user_id = v_user_id and kind = 'loan';

  if not found then
    raise exception 'loan plan not found';
  end if;

  -- The edited row is the earliest of this range, so every rescheduled month is
  -- earlier than or equal to the one the row already had. Walking the range in
  -- calendar order therefore never collides with the (plan_id, year, month)
  -- unique index while the rows are being moved.
  for v_occurrence in
    select id
    from public.expense_occurrences
    where plan_id = p_plan_id
      and user_id = v_user_id
      and (year, month) >= (p_from_year, p_from_month)
    order by year, month
  loop
    if v_index >= v_target_count then
      -- The new total is shorter: the leftover installments at the end go away.
      delete from public.expense_occurrences where id = v_occurrence.id;
      continue;
    end if;

    v_target_date := make_date(p_from_year, p_from_month, 1) + (v_index || ' months')::interval;

    update public.expense_occurrences
    set year = extract(year from v_target_date)::int,
        month = extract(month from v_target_date)::int,
        installment_number = p_from_installment + v_index
    where id = v_occurrence.id;

    v_index := v_index + 1;
  end loop;

  -- The new total is longer: the extra installments are added with no amount.
  while v_index < v_target_count loop
    v_target_date := make_date(p_from_year, p_from_month, 1) + (v_index || ' months')::interval;

    insert into public.expense_occurrences (
      user_id, plan_id, year, month, installment_number, amount, amount_is_estimated
    ) values (
      v_user_id,
      p_plan_id,
      extract(year from v_target_date)::int,
      extract(month from v_target_date)::int,
      p_from_installment + v_index,
      null,
      false
    );

    v_index := v_index + 1;
  end loop;
end;
$$;

-- One call for both "completar la cuota del mes" and the batch form: either
-- every amount lands or none does, so a half-saved batch can't happen.
create or replace function public.set_loan_installment_amounts(p_items jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_amount numeric;
  v_updated int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'the installment amounts must arrive as a json array';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_amount := (v_item ->> 'amount')::numeric;

    if v_amount is null or v_amount <= 0 then
      raise exception 'every installment amount must be greater than zero';
    end if;

    update public.expense_occurrences as occurrence
    set amount = v_amount
    from public.spending_plans as plan
    where occurrence.id = (v_item ->> 'occurrence_id')::uuid
      and occurrence.user_id = v_user_id
      and plan.id = occurrence.plan_id
      and plan.kind = 'loan';

    get diagnostics v_updated = row_count;

    if v_updated = 0 then
      raise exception 'loan installment not found';
    end if;
  end loop;
end;
$$;

revoke execute on function public.create_loan(
  text, text, int, int, int, int, numeric
) from public;
grant execute on function public.create_loan(
  text, text, int, int, int, int, numeric
) to authenticated;

revoke execute on function public.update_loan(
  uuid, text, text, int, int, int, int
) from public;
grant execute on function public.update_loan(
  uuid, text, text, int, int, int, int
) to authenticated;

revoke execute on function public.set_loan_installment_amounts(jsonb) from public;
grant execute on function public.set_loan_installment_amounts(jsonb) to authenticated;
