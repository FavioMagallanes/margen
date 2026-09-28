import { useQuery } from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type { ExpenseLine } from "../model/expense-total"

export type MonthlyBudgetRow = {
  salaryArs: number | null
  exchangeRateValue: number | null
}

// Query keys carry the owner and the month so two sessions or two months never
// share a cache entry.
export const monthlyBudgetKeys = {
  budget: (userId: string, { year, month }: Period) =>
    ["monthly-budget", userId, "budget", year, month] as const,
  expenseLines: (userId: string, { year, month }: Period) =>
    ["monthly-budget", userId, "expense-lines", year, month] as const,
}

export const fetchMonthlyBudget = async ({
  year,
  month,
}: Period): Promise<MonthlyBudgetRow | null> => {
  // RLS scopes the read to the authenticated user, so no user_id filter here.
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select("salary_ars, exchange_rate_value")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (data === null) {
    return null
  }

  return {
    salaryArs: data.salary_ars,
    exchangeRateValue: data.exchange_rate_value,
  }
}

const OTHER_EXPENSES_GROUP = "Otros gastos"

const formatInstallment = (
  installmentNumber: number | null,
  totalInstallments: number | null
): string | null => {
  if (installmentNumber === null) {
    return null
  }

  return totalInstallments === null
    ? String(installmentNumber)
    : `${installmentNumber}/${totalInstallments}`
}

export const fetchMonthExpenseLines = async ({
  year,
  month,
}: Period): Promise<ExpenseLine[]> => {
  const occurrences = await supabase
    .from("expense_occurrences")
    .select(
      "id, amount, installment_number, spending_plans(concept, group_label, currency, total_installments)"
    )
    .eq("year", year)
    .eq("month", month)

  if (occurrences.error) {
    throw new Error(occurrences.error.message)
  }

  const others = await supabase
    .from("other_expenses")
    .select("id, concept, amount, currency")
    .eq("year", year)
    .eq("month", month)

  if (others.error) {
    throw new Error(others.error.message)
  }

  const planLines: ExpenseLine[] = (occurrences.data ?? []).map((row) => ({
    id: row.id,
    concept: row.spending_plans?.concept ?? "",
    group: row.spending_plans?.group_label ?? "",
    installment: formatInstallment(
      row.installment_number,
      row.spending_plans?.total_installments ?? null
    ),
    amount: row.amount,
    currency: row.spending_plans?.currency ?? null,
  }))

  const otherLines: ExpenseLine[] = (others.data ?? []).map((row) => ({
    id: row.id,
    concept: row.concept,
    group: OTHER_EXPENSES_GROUP,
    installment: null,
    amount: row.amount,
    currency: row.currency,
  }))

  return [...planLines, ...otherLines]
}

export const useMonthlyBudgetQuery = (userId: string | null, period: Period) =>
  useQuery({
    queryKey: monthlyBudgetKeys.budget(userId ?? "", period),
    queryFn: () => fetchMonthlyBudget(period),
    enabled: userId !== null,
  })

export const useMonthExpenseLinesQuery = (
  userId: string | null,
  period: Period
) =>
  useQuery({
    queryKey: monthlyBudgetKeys.expenseLines(userId ?? "", period),
    queryFn: () => fetchMonthExpenseLines(period),
    enabled: userId !== null,
  })
