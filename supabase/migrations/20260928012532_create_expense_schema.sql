-- Core schema for Margen: monthly budgets, installment/loan/recurring plans,
-- their monthly occurrences, and standalone one-off expenses.
-- Single-user app: every table is scoped to auth.uid() via RLS.

-- Shared trigger to keep updated_at accurate on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per calendar month: salary and the exchange rate applied that month.
-- salary_ars is nullable on purpose: "no cargado" is not the same as zero (RF-01).
create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  salary_ars numeric(14, 2) check (salary_ars >= 0),
  exchange_rate_value numeric(14, 4) check (exchange_rate_value > 0),
  exchange_rate_source text check (exchange_rate_source in ('api', 'manual')),
  -- When we queried or edited the rate, vs. exchange_rate_source_updated_at
  -- which is when the source itself reports the value was last updated.
  -- RF-07 requires these to never be conflated in the UI.
  exchange_rate_fetched_at timestamptz,
  exchange_rate_source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, month)
);

-- A plan is anything that produces more than one monthly occurrence:
-- a card purchase in installments, a loan, or a recurring expense.
-- One-off expenses never get a plan row (see other_expenses below).
create table public.spending_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('card_purchase', 'loan', 'recurring')),
  concept text not null check (btrim(concept) <> ''),
  -- Card name ('bbva' | 'supervielle' | user-entered card), loan entity
  -- (free text per D-08), or 'other' for a non-card recurring expense.
  group_label text not null check (btrim(group_label) <> ''),
  currency text not null check (currency in ('ars', 'usd')),
  total_installments int check (total_installments > 0),
  -- Fixed amount shared by every occurrence. Only meaningful for a
  -- fixed-amount card purchase or a fixed-amount recurring expense; loans
  -- always carry their amount per installment instead (D-09).
  default_amount numeric(14, 2) check (default_amount > 0),
  stopped_from_year int,
  stopped_from_month int check (stopped_from_month between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_are_ars_only
    check (kind <> 'loan' or currency = 'ars'),
  constraint loans_have_no_default_amount
    check (kind <> 'loan' or default_amount is null),
  constraint finite_plans_require_a_total
    check (kind = 'recurring' or total_installments is not null)
);

create index spending_plans_user_kind_idx
  on public.spending_plans (user_id, kind);

-- One row per month a plan actually appears in. installment_number only
-- applies to card_purchase/loan; recurring appearances are not numbered.
-- amount is nullable on purpose: a missing loan installment shows "Falta
-- completar importe" (RF-03) instead of being treated as zero.
create table public.expense_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.spending_plans (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  installment_number int check (installment_number > 0),
  amount numeric(14, 2) check (amount > 0),
  amount_is_estimated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Guarantees a plan can't get the same month twice, even on retry
  -- (CA-08: reopening a month or retrying a save must not duplicate it).
  unique (plan_id, year, month)
);

create index expense_occurrences_user_month_idx
  on public.expense_occurrences (user_id, year, month);

-- Single-payment expenses with no plan behind them: they never generate
-- future occurrences (RF-04).
create table public.other_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 1 and 12),
  concept text not null check (btrim(concept) <> ''),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency in ('ars', 'usd')),
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index other_expenses_user_month_idx
  on public.other_expenses (user_id, year, month);

create trigger set_updated_at before update on public.monthly_budgets
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.spending_plans
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.expense_occurrences
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.other_expenses
  for each row execute function public.set_updated_at();

-- Row level security: every table is single-user-owned, scoped to auth.uid().
alter table public.monthly_budgets enable row level security;
alter table public.spending_plans enable row level security;
alter table public.expense_occurrences enable row level security;
alter table public.other_expenses enable row level security;

create policy "Owner can manage their monthly budgets"
  on public.monthly_budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owner can manage their spending plans"
  on public.spending_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owner can manage their expense occurrences"
  on public.expense_occurrences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owner can manage their other expenses"
  on public.other_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
