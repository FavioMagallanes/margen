import { useQuery } from "@tanstack/react-query"

import {
  fetchMonthlyBudget,
  type MonthlyBudgetRow,
} from "@/features/monthly-budget/api/monthly-budget-queries"
import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import {
  type FinitePlan,
  type KnownOccurrence,
  type PlanEnding,
  toUpcomingPlanEndings,
} from "../model/plan-ending"
import type { UpcomingExpenseLine } from "../model/upcoming-line"

/** Everything the viewed month commits, plus the budget it is measured against. */
export type UpcomingMonth = {
  lines: UpcomingExpenseLine[]
  budget: MonthlyBudgetRow | null
}

// RF-04: this view only looks at credit card installments, so every query is
// narrowed to that plan kind.
const CARD_PURCHASE_KIND = "card_purchase"

// Query keys carry the owner and the month so two sessions or two months never
// share a cache entry.
export const upcomingKeys = {
  month: (userId: string, { year, month }: Period) =>
    ["upcoming-expenses", userId, "month", year, month] as const,
  planEndings: (userId: string, { year, month }: Period) =>
    ["upcoming-expenses", userId, "plan-endings", year, month] as const,
}

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
  // The "!inner" join is what makes the kind filter drop the occurrences of
  // other plan kinds instead of only emptying the embedded plan.
  const { data, error } = await supabase
    .from("expense_occurrences")
    .select(
      "id, amount, amount_is_estimated, installment_number, spending_plans!inner(concept, group_label, currency, total_installments)"
    )
    .eq("year", year)
    .eq("month", month)
    .eq("spending_plans.kind", CARD_PURCHASE_KIND)
    // A single payment has no pending installments, so this view ignores it
    // even on the month where it was loaded.
    .gt("spending_plans.total_installments", 1)
    // RF-05: a skipped month is an explicit absence, not a line waiting for
    // its amount, so nothing is committed by it.
    .eq("is_skipped", false)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    concept: row.spending_plans.concept,
    group: row.spending_plans.group_label,
    installment: formatInstallment(
      row.installment_number,
      row.spending_plans.total_installments
    ),
    amount: row.amount,
    currency: row.spending_plans.currency,
    amountIsEstimated: row.amount_is_estimated,
  }))
}

/**
 * The month as it is already committed by the card installments that exist.
 * Reading a month writes nothing, so nothing is generated here (RF-05).
 */
export const fetchUpcomingExpenseLines = async (
  period: Period
): Promise<UpcomingMonth> => {
  const [lines, budget] = await Promise.all([
    fetchGeneratedLines(period),
    fetchMonthlyBudget(period),
  ])

  return { lines, budget }
}

/**
 * The earliest generated month of a plan together with the installment it
 * represents. A row without an installment number cannot anchor the plan, so
 * it is ignored; a plan with no usable row has no known occurrence at all.
 */
const earliestKnownOccurrence = (
  occurrences: readonly {
    year: number
    month: number
    installment_number: number | null
  }[]
): KnownOccurrence | null =>
  occurrences.reduce<KnownOccurrence | null>((earliest, occurrence) => {
    if (occurrence.installment_number === null) {
      return earliest
    }

    const period = { year: occurrence.year, month: occurrence.month }

    if (
      earliest === null ||
      period.year < earliest.period.year ||
      (period.year === earliest.period.year &&
        period.month < earliest.period.month)
    ) {
      return { period, installmentNumber: occurrence.installment_number }
    }

    return earliest
  }, null)

/**
 * Every card plan of more than one installment still running on the viewed
 * month. The ending is month arithmetic over a known installment, so a plan
 * whose later months are not generated yet still reports the right end, and a
 * plan loaded from a later installment is not pushed into the future.
 */
export const fetchUpcomingPlanEndings = async (
  period: Period
): Promise<PlanEnding[]> => {
  const { data, error } = await supabase
    .from("spending_plans")
    .select(
      "id, concept, group_label, total_installments, stopped_from_year, stopped_from_month, expense_occurrences(year, month, installment_number)"
    )
    .eq("kind", CARD_PURCHASE_KIND)
    // A single payment is not a plan of pending installments, so it never
    // belongs to this table.
    .gt("total_installments", 1)

  if (error) {
    throw new Error(error.message)
  }

  const plans = (data ?? []).flatMap<FinitePlan>((plan) => {
    if (plan.total_installments === null) {
      return []
    }

    return {
      planId: plan.id,
      concept: plan.concept,
      groupLabel: plan.group_label,
      totalInstallments: plan.total_installments,
      knownOccurrence: earliestKnownOccurrence(plan.expense_occurrences ?? []),
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
