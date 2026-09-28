-- RF-09 "carga de varios gastos": the whole batch of card purchases is saved
-- as one plpgsql call, so a single failing item leaves no half-loaded plan
-- behind (AGENTS.md §8: an operation that must land complete is atomic).
-- Each item repeats exactly the validation and creation of
-- create_card_purchase; the card, the year and the month are shared by the
-- batch because the user chose them once.
create or replace function public.create_card_purchases_batch(
  p_card text,
  p_year int,
  p_month int,
  -- Each item is {concept, currency, quota_amount, starting_installment,
  -- total_installments}.
  p_items jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_concept text;
  v_currency text;
  v_quota_amount numeric;
  v_starting_installment int;
  v_total_installments int;
  v_plan_id uuid;
  v_offset int;
  v_target_date date;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'the card purchases must arrive as a json array';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'the batch must have at least one card purchase';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_concept := v_item ->> 'concept';
    v_currency := v_item ->> 'currency';
    v_quota_amount := (v_item ->> 'quota_amount')::numeric;
    v_starting_installment := (v_item ->> 'starting_installment')::int;
    v_total_installments := (v_item ->> 'total_installments')::int;

    if v_concept is null or btrim(v_concept) = '' then
      raise exception 'every card purchase needs a concept';
    end if;

    if v_currency is null then
      raise exception 'every card purchase needs a currency';
    end if;

    if v_quota_amount is null or v_quota_amount <= 0 then
      raise exception 'every quota amount must be greater than zero';
    end if;

    if v_starting_installment is null or v_total_installments is null then
      raise exception 'every card purchase needs its installment numbers';
    end if;

    if v_starting_installment < 1 or v_starting_installment > v_total_installments then
      raise exception 'starting installment must be between 1 and the total installments';
    end if;

    insert into public.spending_plans (
      user_id, kind, concept, group_label, currency, total_installments, default_amount
    ) values (
      v_user_id, 'card_purchase', v_concept, p_card, v_currency, v_total_installments, v_quota_amount
    )
    returning id into v_plan_id;

    for v_offset in 0 .. (v_total_installments - v_starting_installment) loop
      v_target_date := make_date(p_year, p_month, 1) + (v_offset || ' months')::interval;

      insert into public.expense_occurrences (
        user_id, plan_id, year, month, installment_number, amount, amount_is_estimated
      ) values (
        v_user_id,
        v_plan_id,
        extract(year from v_target_date)::int,
        extract(month from v_target_date)::int,
        v_starting_installment + v_offset,
        v_quota_amount,
        false
      );
    end loop;
  end loop;
end;
$$;

revoke execute on function public.create_card_purchases_batch(
  text, int, int, jsonb
) from public;
grant execute on function public.create_card_purchases_batch(
  text, int, int, jsonb
) to authenticated;
