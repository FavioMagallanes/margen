import { useQuery } from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type { ReportExpenseKind, ReportExpenseLine } from "../model/report-line"
import {
  isPeriodInScope,
  type ReportScope,
  scopeCacheKey,
  scopeYearBounds,
} from "../model/report-scope"

/** Salary, rate and month of every period the scope touches. */
export type ReportMonthlyBudget = {
  period: Period
  salaryArs: number | null
  exchangeRateValue: number | null
  exchangeRateSource: string | null
  exchangeRateFetchedAt: string | null
}

// Query keys carry the owner and the scope so two sessions or two scopes never
// share a cache entry.
export const reportKeys = {
  expenseLines: (userId: string, scope: ReportScope) =>
    ["reports", userId, "expense-lines", scopeCacheKey(scope)] as const,
  monthlyBudgets: (userId: string, scope: ReportScope) =>
    ["reports", userId, "monthly-budgets", scopeCacheKey(scope)] as const,
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
  scope: ReportScope
): Promise<ReportExpenseLine[]> => {
  // The query builder cannot compare the (year, month) pair, so every read
  // narrows by year and `isPeriodInScope` trims the months of the edge years.
  const { minYear, maxYear } = scopeYearBounds(scope)

  // RLS scopes the read to the authenticated user, so no user_id filter here.
  const occurrencesQuery = supabase
    .from("expense_occurrences")
    .select(
      "id, amount, installment_number, year, month, spending_plans(concept, group_label, currency, total_installments, kind)"
    )
    // RF-05: a skipped recurring month is an explicit absence, not a line
    // waiting for its amount, so it never reaches a report either.
    .eq("is_skipped", false)

  const occurrences = await (minYear === null || maxYear === null
    ? occurrencesQuery
    : occurrencesQuery.gte("year", minYear).lte("year", maxYear))

  if (occurrences.error) {
    throw new Error(occurrences.error.message)
  }

  const othersQuery = supabase
    .from("other_expenses")
    .select("id, concept, amount, currency, year, month")

  const others = await (minYear === null || maxYear === null
    ? othersQuery
    : othersQuery.gte("year", minYear).lte("year", maxYear))

  if (others.error) {
    throw new Error(others.error.message)
  }

  const planLines: ReportExpenseLine[] = (occurrences.data ?? [])
    .filter((row) =>
      isPeriodInScope({ year: row.year, month: row.month }, scope)
    )
    .map((row) => ({
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
    }))

  const otherLines: ReportExpenseLine[] = (others.data ?? [])
    .filter((row) =>
      isPeriodInScope({ year: row.year, month: row.month }, scope)
    )
    .map((row) => ({
      id: row.id,
      concept: row.concept,
      group: OTHER_EXPENSES_GROUP,
      installment: null,
      amount: row.amount,
      currency: row.currency,
      year: row.year,
      month: row.month,
      // Other expenses have no plan, so they carry no stored kind.
      kind: "other" as const,
    }))

  return [...planLines, ...otherLines]
}

export const fetchReportMonthlyBudgets = async (
  scope: ReportScope
): Promise<ReportMonthlyBudget[]> => {
  const { minYear, maxYear } = scopeYearBounds(scope)

  const budgetsQuery = supabase
    .from("monthly_budgets")
    .select(
      "year, month, salary_ars, exchange_rate_value, exchange_rate_source, exchange_rate_fetched_at"
    )

  const { data, error } = await (minYear === null || maxYear === null
    ? budgetsQuery
    : budgetsQuery.gte("year", minYear).lte("year", maxYear))

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? [])
    .filter((row) =>
      isPeriodInScope({ year: row.year, month: row.month }, scope)
    )
    .map((row) => ({
      period: { year: row.year, month: row.month },
      salaryArs: row.salary_ars,
      exchangeRateValue: row.exchange_rate_value,
      exchangeRateSource: row.exchange_rate_source,
      exchangeRateFetchedAt: row.exchange_rate_fetched_at,
    }))
}

export const useReportExpenseLinesQuery = (
  userId: string | null,
  scope: ReportScope
) =>
  useQuery({
    queryKey: reportKeys.expenseLines(userId ?? "", scope),
    queryFn: () => fetchReportExpenseLines(scope),
    enabled: userId !== null,
  })

export const useReportMonthlyBudgetsQuery = (
  userId: string | null,
  scope: ReportScope
) =>
  useQuery({
    queryKey: reportKeys.monthlyBudgets(userId ?? "", scope),
    queryFn: () => fetchReportMonthlyBudgets(scope),
    enabled: userId !== null,
  })
