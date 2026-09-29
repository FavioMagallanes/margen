import { useQuery } from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type { ReportExpenseKind, ReportExpenseLine } from "../model/report-line"

/** Salary, rate and month of the reported period. */
export type ReportMonthlyBudget = {
  period: Period
  salaryArs: number | null
  exchangeRateValue: number | null
  exchangeRateSource: string | null
  exchangeRateFetchedAt: string | null
}

const periodCacheKey = (period: Period): string =>
  `${period.year}-${period.month}`

// Query keys carry the owner and the period so two sessions or two months
// never share a cache entry.
export const reportKeys = {
  expenseLines: (userId: string, period: Period) =>
    ["reports", userId, "expense-lines", periodCacheKey(period)] as const,
  monthlyBudgets: (userId: string, period: Period) =>
    ["reports", userId, "monthly-budgets", periodCacheKey(period)] as const,
}

const OTHER_EXPENSES_GROUP = "Otros gastos"

const toReportKind = (kind: string | undefined): ReportExpenseKind =>
  kind === "card_purchase" || kind === "loan" || kind === "recurring"
    ? kind
    : "other"

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

export const fetchReportExpenseLines = async (
  period: Period
): Promise<ReportExpenseLine[]> => {
  // RLS scopes the read to the authenticated user, so no user_id filter here.
  const occurrences = await supabase
    .from("expense_occurrences")
    .select(
      "id, amount, amount_is_estimated, installment_number, year, month, spending_plans(concept, group_label, currency, total_installments, kind)"
    )
    // RF-05: a skipped recurring month is an explicit absence, not a line
    // waiting for its amount, so it never reaches a report either.
    .eq("is_skipped", false)
    .eq("year", period.year)
    .eq("month", period.month)

  if (occurrences.error) {
    throw new Error(occurrences.error.message)
  }

  const others = await supabase
    .from("other_expenses")
    .select("id, concept, amount, currency, year, month")
    .eq("year", period.year)
    .eq("month", period.month)

  if (others.error) {
    throw new Error(others.error.message)
  }

  const planLines: ReportExpenseLine[] = (occurrences.data ?? []).map(
    (row) => ({
      id: row.id,
      concept: row.spending_plans?.concept ?? "",
      group: row.spending_plans?.group_label ?? "",
      installment: formatInstallment(
        row.installment_number,
        row.spending_plans?.total_installments ?? null
      ),
      amount: row.amount,
      currency: row.spending_plans?.currency ?? null,
      year: row.year,
      month: row.month,
      kind: toReportKind(row.spending_plans?.kind),
      amountIsEstimated: row.amount_is_estimated,
    })
  )

  const otherLines: ReportExpenseLine[] = (others.data ?? []).map((row) => ({
    id: row.id,
    concept: row.concept,
    group: OTHER_EXPENSES_GROUP,
    installment: null,
    amount: row.amount,
    currency: row.currency,
    year: row.year,
    month: row.month,
    // Other expenses have no plan, so they carry no stored kind and no
    // estimated flag: their amount is always the one that was loaded.
    kind: "other" as const,
    amountIsEstimated: false,
  }))

  return [...planLines, ...otherLines]
}

export const fetchReportMonthlyBudgets = async (
  period: Period
): Promise<ReportMonthlyBudget[]> => {
  const { data, error } = await supabase
    .from("monthly_budgets")
    .select(
      "year, month, salary_ars, exchange_rate_value, exchange_rate_source, exchange_rate_fetched_at"
    )
    .eq("year", period.year)
    .eq("month", period.month)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    period: { year: row.year, month: row.month },
    salaryArs: row.salary_ars,
    exchangeRateValue: row.exchange_rate_value,
    exchangeRateSource: row.exchange_rate_source,
    exchangeRateFetchedAt: row.exchange_rate_fetched_at,
  }))
}

export const useReportExpenseLinesQuery = (
  userId: string | null,
  period: Period
) =>
  useQuery({
    queryKey: reportKeys.expenseLines(userId ?? "", period),
    queryFn: () => fetchReportExpenseLines(period),
    enabled: userId !== null,
  })

export const useReportMonthlyBudgetsQuery = (
  userId: string | null,
  period: Period
) =>
  useQuery({
    queryKey: reportKeys.monthlyBudgets(userId ?? "", period),
    queryFn: () => fetchReportMonthlyBudgets(period),
    enabled: userId !== null,
  })
