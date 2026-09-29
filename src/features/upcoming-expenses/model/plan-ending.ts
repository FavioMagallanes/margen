import {
  isPeriodOnOrAfter,
  isStoppedAt,
} from "@/features/recurring-expenses/model/recurring-plans"
import { addMonths, type Period } from "@/shared/lib/period"

/**
 * One generated month of a plan, with the installment it represents. The user
 * can load a purchase starting from any installment, so the plan cannot be
 * anchored on the assumption that its earliest row is the first installment.
 */
export type KnownOccurrence = {
  period: Period
  installmentNumber: number
}

/**
 * A card plan with a known number of installments, as the database holds it.
 * The known occurrence is null when the plan has no usable generated month.
 */
export type FinitePlan = {
  planId: string
  concept: string
  groupLabel: string
  totalInstallments: number
  knownOccurrence: KnownOccurrence | null
  stoppedFrom: Period | null
}

export type PlanEnding = {
  planId: string
  concept: string
  groupLabel: string
  endsAt: Period
}

/**
 * Month arithmetic over a known installment, not a count of generated rows:
 * installments advance one calendar month each, so the months still missing
 * after the known one are `totalInstallments - installmentNumber`.
 */
export const planEndingPeriod = (
  period: Period,
  installmentNumber: number,
  totalInstallments: number
): Period => addMonths(period, totalInstallments - installmentNumber)

const byEndingPeriod = (left: PlanEnding, right: PlanEnding): number =>
  left.endsAt.year - right.endsAt.year || left.endsAt.month - right.endsAt.month

const toPlanEnding = (plan: FinitePlan, period: Period): PlanEnding | null => {
  if (plan.knownOccurrence === null || isStoppedAt(plan.stoppedFrom, period)) {
    return null
  }

  const endsAt = planEndingPeriod(
    plan.knownOccurrence.period,
    plan.knownOccurrence.installmentNumber,
    plan.totalInstallments
  )

  if (!isPeriodOnOrAfter(endsAt, period)) {
    return null
  }

  return {
    planId: plan.planId,
    concept: plan.concept,
    groupLabel: plan.groupLabel,
    endsAt,
  }
}

/** Plans still running on the viewed month, from the closest ending onwards. */
export const toUpcomingPlanEndings = (
  plans: readonly FinitePlan[],
  period: Period
): PlanEnding[] =>
  plans.flatMap((plan) => toPlanEnding(plan, period) ?? []).sort(byEndingPeriod)
