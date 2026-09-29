import { useQuery } from "@tanstack/react-query"

import {
  fetchMonthlyBudget,
  type MonthlyBudgetRow,
} from "@/features/monthly-budget/api/monthly-budget-queries"
import { fetchRecurringPlans } from "@/features/recurring-expenses/api/recurring-expense-queries"
import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import {
  type FinitePlan,
  type PlanEnding,
  toUpcomingPlanEndings,
} from "../model/plan-ending"
import {
  toProjectedRecurringLines,
  type UpcomingExpenseKind,
  type UpcomingExpenseLine,
} from "../model/upcoming-line"

/** Everything the viewed month commits, plus the budget it is measured against. */
export type UpcomingMonth = {
  lines: UpcomingExpenseLine[]
  budget: MonthlyBudgetRow | null
}

// Query keys carry the owner and the month so two sessions or two months never
// share a cache entry.
export const upcomingKeys = {
  month: (userId: string, { year, month }: Period) =>
    ["upcoming-expenses", userId, "month", year, month] as const,
  planEndings: (userId: string, { year, month }: Period) =>
    ["upcoming-expenses", userId, "plan-endings", year, month] as const,
}

const toUpcomingKind = (
  kind: string | undefined
): UpcomingExpenseKind | null =>
  kind === "card_purchase" || kind === "loan" || kind === "recurring"
    ? kind
    : null

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

const fetchGeneratedLines = async ({
  year,
  month,
}: Period): Promise<UpcomingExpenseLine[]> => {
  // RLS scopes the read to the authenticated user, so no user_id filter here.
  const { data, error } = await supabase
    .from("expense_occurrences")
    .select(
      "id, amount, amount_is_estimated, installment_number, spending_plans(concept, group_label, currency, total_installments, kind)"
    )
    .eq("year", year)
    .eq("month", month)
    // RF-05: a skipped recurring month is an explicit absence, not a line
    // waiting for its amount, so nothing is committed by it.
    .eq("is_skipped", false)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).flatMap((row) => {
    const kind = toUpcomingKind(row.spending_plans?.kind)

    if (kind === null) {
      return []
    }

    return {
      id: row.id,
      concept: row.spending_plans?.concept ?? "",
      group: row.spending_plans?.group_label ?? "",
      installment: formatInstallment(
        row.installment_number,
        row.spending_plans?.total_installments ?? null
      ),
      amount: row.amount,
      currency: row.spending_plans?.currency ?? null,
      kind,
      origin: "generated" as const,
      amountIsEstimated: row.amount_is_estimated,
    }
  })
}

/**
 * The month as it is already committed: the rows that exist plus the recurring
 * months that the rules guarantee but nobody generated yet. Reading a month
 * writes nothing, so the projected part never becomes a row here (RF-05).
 */
export const fetchUpcomingExpenseLines = async (
  period: Period
): Promise<UpcomingMonth> => {
  const [generatedLines, recurringPlans, budget] = await Promise.all([
    fetchGeneratedLines(period),
    fetchRecurringPlans(),
    fetchMonthlyBudget(period),
  ])

  return {
    lines: [
      ...generatedLines,
      ...toProjectedRecurringLines(recurringPlans, period),
    ],
    budget,
  }
}

const earliestPeriod = (
  occurrences: readonly { year: number; month: number }[]
): Period | null =>
  occurrences.reduce<Period | null>((earliest, occurrence) => {
    if (
      earliest === null ||
      occurrence.year < earliest.year ||
      (occurrence.year === earliest.year && occurrence.month < earliest.month)
    ) {
      return { year: occurrence.year, month: occurrence.month }
    }

    return earliest
  }, null)

/**
 * Every plan with a fixed number of installments still running on the viewed
 * month. The ending is month arithmetic over the first generated month, so a
 * plan whose later months are not generated yet still reports the right end.
 */
export const fetchUpcomingPlanEndings = async (
  period: Period
): Promise<PlanEnding[]> => {
  const { data, error } = await supabase
    .from("spending_plans")
    .select(
      "id, concept, group_label, kind, total_installments, stopped_from_year, stopped_from_month, expense_occurrences(year, month)"
    )
    .not("total_installments", "is", null)

  if (error) {
    throw new Error(error.message)
  }

  const plans = (data ?? []).flatMap<FinitePlan>((plan) => {
    const kind = toUpcomingKind(plan.kind)

    if (kind === null || plan.total_installments === null) {
      return []
    }

    return {
      planId: plan.id,
      concept: plan.concept,
      groupLabel: plan.group_label,
      kind,
      totalInstallments: plan.total_installments,
      firstPeriod: earliestPeriod(plan.expense_occurrences ?? []),
      stoppedFrom:
        plan.stopped_from_year === null || plan.stopped_from_month === null
          ? null
          : { year: plan.stopped_from_year, month: plan.stopped_from_month },
    }
  })

  return toUpcomingPlanEndings(plans, period)
}

export const useUpcomingExpenseLinesQuery = (
  userId: string | null,
  period: Period
) =>
  useQuery({
    queryKey: upcomingKeys.month(userId ?? "", period),
    queryFn: () => fetchUpcomingExpenseLines(period),
    enabled: userId !== null,
  })

export const useUpcomingPlanEndingsQuery = (
  userId: string | null,
  period: Period
) =>
  useQuery({
    queryKey: upcomingKeys.planEndings(userId ?? "", period),
    queryFn: () => fetchUpcomingPlanEndings(period),
    enabled: userId !== null,
  })
