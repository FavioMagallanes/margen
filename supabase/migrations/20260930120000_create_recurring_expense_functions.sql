-- Recurring expenses (RF-05) differ from card purchases and loans in that a
-- "mensual hasta detener" plan has no known end, so its occurrences can never
-- be generated all at once. Every month is created by an explicit user action
-- (AGENTS.md: a read projection must not persist rows), which is why the
-- functions below always work on a single (year, month).

-- A skipped month still gets a row so reopening the month knows the decision
-- was already taken, but it carries no amount: it is neither a expense nor a
-- missing datum.
alter table public.expense_occurrences
  add column is_skipped boolean not null default false;

alter table public.expense_occurrences
  add constraint skipped_occurrences_have_no_amount
    check (not is_skipped or amount is null);

-- Creates the plan and only the month the user is standing on. Nothing is
-- pre-generated for the following months, not even for a finite plan.
create or replace function public.create_recurring_plan(
  p_concept text,
  p_group_label text,
  p_currency text,
  p_year int,
  p_month int,
  p_starting_amount numeric,
  -- Null means "importe variable": there is no value to repeat every month.
  p_default_amount numeric default null,
  -- Null means "mensual hasta detener": the plan has no known end.
  p_total_installments int default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_starting_amount is null or p_starting_amount <= 0 then
    raise exception 'the amount of the first month must be greater than zero';
  end if;

  if p_total_installments is not null and p_total_installments < 1 then
    raise exception 'the number of months must be greater than zero';
  end if;

  insert into public.spending_plans (
    user_id, kind, concept, group_label, currency, total_installments, default_amount
  ) values (
    v_user_id,
    'recurring',
    p_concept,
    p_group_label,
    p_currency,
    p_total_installments,
    p_default_amount
  )
  returning id into v_plan_id;

  -- Recurring appearances are not numbered, so installment_number stays null.
  insert into public.expense_occurrences (
    user_id, plan_id, year, month, installment_number, amount, amount_is_estimated, is_skipped
  ) values (
    v_user_id, v_plan_id, p_year, p_month, null, p_starting_amount, false, false
  );

  return v_plan_id;
end;
$$;

-- Concept, group and currency live in the plan and are read by join, so
-- editing them changes every month at once, exactly like loans and card
-- purchases. The only value that needs the "desde este mes" treatment is the
-- fixed amount already copied into the generated months.
create or replace function public.update_recurring_plan(
  p_plan_id uuid,
  p_concept text,
  p_group_label text,
  p_currency text,
  p_from_year int,
  p_from_month int,
  p_default_amount numeric default null,
  p_total_installments int default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous_default numeric;
  v_occurrence record;
  v_index int := 0;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_total_installments is not null and p_total_installments < 1 then
    raise exception 'the number of months must be greater than zero';
  end if;

  select default_amount into v_previous_default
  from public.spending_plans
  where id = p_plan_id and user_id = v_user_id and kind = 'recurring';

  if not found then
    raise exception 'recurring plan not found';
  end if;

  update public.spending_plans
  set concept = p_concept,
      group_label = p_group_label,
      currency = p_currency,
      default_amount = p_default_amount,
      total_installments = p_total_installments
  where id = p_plan_id and user_id = v_user_id and kind = 'recurring';

  -- Only the months that still carried the previous default are refreshed: an
  -- amount the user already corrected for a particular month is an exception
  -- that the new default must not overwrite.
  if v_previous_default is not null
     and p_default_amount is not null
     and p_default_amount <> v_previous_default then
    update public.expense_occurrences
    set amount = p_default_amount
    where plan_id = p_plan_id
      and user_id = v_user_id
      and not is_skipped
      and amount = v_previous_default
      and (year, month) >= (p_from_year, p_from_month);
  end if;

  -- A shorter plan drops the surplus months counting from the end, and never
  -- touches a month earlier than the one the edit was opened from.
  if p_total_installments is not null then
    for v_occurrence in
      select id, year, month
      from public.expense_occurrences
      where plan_id = p_plan_id and user_id = v_user_id
      order by year, month
    loop
      v_index := v_index + 1;

      if v_index > p_total_installments
         and (v_occurrence.year, v_occurrence.month) >= (p_from_year, p_from_month) then
        delete from public.expense_occurrences where id = v_occurrence.id;
      end if;
    end loop;
  end if;
end;
$$;

-- One call for the whole month: either every pending recurring expense of that
-- month lands or none does (same guarantee as set_loan_installment_amounts).
-- Each item is {plan_id, action: 'fill' | 'skip', amount?, is_estimated?}.
create or replace function public.set_recurring_occurrences(
  p_year int,
  p_month int,
  p_items jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_plan_id uuid;
  v_action text;
  v_amount numeric;
  v_is_estimated boolean;
  v_plan record;
  v_generated int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'the recurring items must arrive as a json array';
  end if;

  if p_month < 1 or p_month > 12 then
    raise exception 'the month must be between 1 and 12';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_plan_id := (v_item ->> 'plan_id')::uuid;
    v_action := v_item ->> 'action';

    select id, total_installments, stopped_from_year, stopped_from_month
    into v_plan
    from public.spending_plans
    where id = v_plan_id and user_id = v_user_id and kind = 'recurring';

    if not found then
      raise exception 'recurring plan not found';
    end if;

    if v_plan.stopped_from_year is not null
       and (v_plan.stopped_from_year, coalesce(v_plan.stopped_from_month, 1))
           <= (p_year, p_month) then
      raise exception 'the recurring expense is stopped for that month';
    end if;

    if v_plan.total_installments is not null then
      select count(*) into v_generated
      from public.expense_occurrences
      where plan_id = v_plan_id and user_id = v_user_id;

      if v_generated >= v_plan.total_installments then
        raise exception 'the recurring expense already reached its number of months';
      end if;
    end if;

    if v_action = 'skip' then
      -- A skipped month is an explicit absence: no amount, no "Sin dato".
      insert into public.expense_occurrences (
        user_id, plan_id, year, month, amount, amount_is_estimated, is_skipped
      ) values (
        v_user_id, v_plan_id, p_year, p_month, null, false, true
      );
    elsif v_action = 'fill' then
      v_amount := (v_item ->> 'amount')::numeric;
      v_is_estimated := coalesce((v_item ->> 'is_estimated')::boolean, false);

      if v_amount is null or v_amount <= 0 then
        raise exception 'every recurring amount must be greater than zero';
      end if;

      insert into public.expense_occurrences (
        user_id, plan_id, year, month, amount, amount_is_estimated, is_skipped
      ) values (
        v_user_id, v_plan_id, p_year, p_month, v_amount, v_is_estimated, false
      );
    else
      raise exception 'the recurring action must be fill or skip';
    end if;
  end loop;
end;
$$;

-- Corrects the amount of a month already generated. A skipped month is left
-- out on purpose: it is not a row waiting for an amount.
create or replace function public.set_recurring_occurrence_amount(
  p_occurrence_id uuid,
  p_amount numeric,
  p_is_estimated boolean
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'the amount must be greater than zero';
  end if;

  update public.expense_occurrences as occurrence
  set amount = p_amount,
      amount_is_estimated = p_is_estimated
  from public.spending_plans as plan
  where occurrence.id = p_occurrence_id
    and occurrence.user_id = v_user_id
    and not occurrence.is_skipped
    and plan.id = occurrence.plan_id
    and plan.kind = 'recurring';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'recurring occurrence not found';
  end if;
end;
$$;

-- Stopping never deletes history: the months already generated before the stop
-- keep their amounts, only the following ones stop being offered.
create or replace function public.stop_recurring_plan(
  p_plan_id uuid,
  p_from_year int,
  p_from_month int
)
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

  if p_from_month < 1 or p_from_month > 12 then
    raise exception 'the month must be between 1 and 12';
  end if;

  update public.spending_plans
  set stopped_from_year = p_from_year,
      stopped_from_month = p_from_month
  where id = p_plan_id and user_id = v_user_id and kind = 'recurring';

  if not found then
    raise exception 'recurring plan not found';
  end if;
end;
$$;

revoke execute on function public.create_recurring_plan(
  text, text, text, int, int, numeric, numeric, int
) from public;
grant execute on function public.create_recurring_plan(
  text, text, text, int, int, numeric, numeric, int
) to authenticated;

revoke execute on function public.update_recurring_plan(
  uuid, text, text, text, int, int, numeric, int
) from public;
grant execute on function public.update_recurring_plan(
  uuid, text, text, text, int, int, numeric, int
) to authenticated;

revoke execute on function public.set_recurring_occurrences(int, int, jsonb) from public;
grant execute on function public.set_recurring_occurrences(int, int, jsonb) to authenticated;

revoke execute on function public.set_recurring_occurrence_amount(
  uuid, numeric, boolean
) from public;
grant execute on function public.set_recurring_occurrence_amount(
  uuid, numeric, boolean
) to authenticated;

revoke execute on function public.stop_recurring_plan(uuid, int, int) from public;
grant execute on function public.stop_recurring_plan(uuid, int, int) to authenticated;
