import type { ExpenseLine } from "@/features/monthly-budget/model/expense-total"
import {
  type RecurringPlan,
  toPendingRecurringPlans,
} from "@/features/recurring-expenses/model/recurring-plans"
import type { Period } from "@/shared/lib/period"

/** Only plan lines reach this view: an unplanned expense commits no future. */
export type UpcomingExpenseKind = "card_purchase" | "loan" | "recurring"

/**
 * Whether the line already exists as a row. A projected line is derived from a
 * recurring rule and is not generated until the user asks for it in /recurring.
 */
export type UpcomingLineOrigin = "generated" | "projected"

/** How much the amount can be trusted, which is what the table has to show. */
export type UpcomingCertainty = "known" | "estimated" | "missing"

export type UpcomingExpenseLine = ExpenseLine & {
  kind: UpcomingExpenseKind
  origin: UpcomingLineOrigin
  /** RF-05: a variable amount carried over from another month is estimated. */
  amountIsEstimated: boolean
}

export const UPCOMING_KIND_LABELS: Record<UpcomingExpenseKind, string> = {
  card_purchase: "Tarjeta",
  loan: "Préstamo",
  recurring: "Recurrente",
}

export const classifyUpcomingLine = (
  line: Pick<UpcomingExpenseLine, "amount" | "amountIsEstimated">
): UpcomingCertainty => {
  if (line.amount === null) {
    return "missing"
  }

  return line.amountIsEstimated ? "estimated" : "known"
}

/**
 * RF-05 / AGENTS.md: reading a future month never generates anything, so every
 * recurring plan that the explicit generation would still offer becomes a
 * derived line instead of a row. A fixed plan repeats its own amount; a
 * variable one can only carry its last real amount, and carries none when it
 * was never loaded.
 */
export const toProjectedRecurringLines = (
  plans: readonly RecurringPlan[],
  period: Period
): UpcomingExpenseLine[] =>
  toPendingRecurringPlans(plans, period).map((plan) => {
    const isFixed = plan.defaultAmount !== null

    return {
      id: `projected-${plan.planId}`,
      concept: plan.concept,
      group: plan.groupLabel,
      installment: null,
      amount: isFixed ? plan.defaultAmount : plan.lastKnownAmount,
      currency: plan.currency,
      kind: "recurring" as const,
      origin: "projected" as const,
      amountIsEstimated: !isFixed && plan.lastKnownAmount !== null,
    }
  })
