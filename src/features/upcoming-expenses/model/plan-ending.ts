import {
  isPeriodOnOrAfter,
  isStoppedAt,
} from "@/features/recurring-expenses/model/recurring-plans"
import { addMonths, type Period } from "@/shared/lib/period"

import type { UpcomingExpenseKind } from "./upcoming-line"

/**
 * A plan with a known number of installments, as the database holds it. The
 * first period comes from its earliest occurrence, and is null when the plan
 * has not generated a single month yet.
 */
export type FinitePlan = {
  planId: string
  concept: string
  groupLabel: string
  kind: UpcomingExpenseKind
  totalInstallments: number
  firstPeriod: Period | null
  stoppedFrom: Period | null
}

export type PlanEnding = {
  planId: string
  concept: string
  groupLabel: string
  kind: UpcomingExpenseKind
  endsAt: Period
}

/**
 * Month arithmetic, not a count of generated rows: a plan whose future months
 * are still ungenerated ends on the same month either way.
 */
export const planEndingPeriod = (
  firstPeriod: Period,
  totalInstallments: number
): Period => addMonths(firstPeriod, totalInstallments - 1)

const byEndingPeriod = (left: PlanEnding, right: PlanEnding): number =>
  left.endsAt.year - right.endsAt.year || left.endsAt.month - right.endsAt.month

const toPlanEnding = (plan: FinitePlan, period: Period): PlanEnding | null => {
  if (plan.firstPeriod === null || isStoppedAt(plan.stoppedFrom, period)) {
    return null
  }

  const endsAt = planEndingPeriod(plan.firstPeriod, plan.totalInstallments)

  if (!isPeriodOnOrAfter(endsAt, period)) {
    return null
  }

  return {
    planId: plan.planId,
    concept: plan.concept,
    groupLabel: plan.groupLabel,
    kind: plan.kind,
    endsAt,
  }
}

/** Plans still running on the viewed month, from the closest ending onwards. */
export const toUpcomingPlanEndings = (
  plans: readonly FinitePlan[],
  period: Period
): PlanEnding[] =>
  plans.flatMap((plan) => toPlanEnding(plan, period) ?? []).sort(byEndingPeriod)
