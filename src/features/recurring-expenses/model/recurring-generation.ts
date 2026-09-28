import { parseAmountInputValue } from "@/shared/lib/amount-input"

import {
  formatRecurringAmountInput,
  isRecurringAmount,
} from "./recurring-expense-form"
import type { PendingRecurringPlan } from "./recurring-plans"

export type RecurringGenerationAction = "fill" | "skip"

export type RecurringGenerationDraft = {
  action: RecurringGenerationAction
  amount: string
  /** True while the amount is still the estimate taken from a past month. */
  isEstimated: boolean
}

/** One row of the batch call, already turned into domain values. */
export type RecurringOccurrenceItem = {
  planId: string
  action: RecurringGenerationAction
  amount: number | null
  isEstimated: boolean
}

/**
 * "empty" keeps «no decidí nada todavía» apart from «decidí algo mal»: a blank
 * amount is a month the user is not generating yet, not an error.
 */
export type RecurringGenerationResult =
  | { status: "valid"; items: RecurringOccurrenceItem[] }
  | { status: "empty" }
  | { status: "invalid"; errors: Record<string, string> }

const AMOUNT_MESSAGE = "Ingresá un importe mayor a cero o dejá el mes vacío"

/**
 * A fixed plan already knows its amount; a variable one is prefilled with the
 * last amount really loaded and marked as an estimate so the user corrects it
 * before confirming. With no past amount there is nothing to estimate from.
 */
export const buildRecurringGenerationDrafts = (
  plans: readonly PendingRecurringPlan[]
): Record<string, RecurringGenerationDraft> =>
  Object.fromEntries(
    plans.map((plan) => {
      if (plan.defaultAmount !== null) {
        return [
          plan.planId,
          {
            action: "fill",
            amount: formatRecurringAmountInput(plan.defaultAmount),
            isEstimated: false,
          },
        ]
      }

      return [
        plan.planId,
        plan.lastKnownAmount === null
          ? { action: "fill", amount: "", isEstimated: false }
          : {
              action: "fill",
              amount: formatRecurringAmountInput(plan.lastKnownAmount),
              isEstimated: true,
            },
      ]
    })
  )

export const parseRecurringGenerationDrafts = (
  plans: readonly PendingRecurringPlan[],
  drafts: Readonly<Record<string, RecurringGenerationDraft>>
): RecurringGenerationResult => {
  const items: RecurringOccurrenceItem[] = []
  const errors: Record<string, string> = {}

  for (const plan of plans) {
    const draft = drafts[plan.planId]

    if (draft === undefined) {
      continue
    }

    if (draft.action === "skip") {
      items.push({
        planId: plan.planId,
        action: "skip",
        amount: null,
        isEstimated: false,
      })
      continue
    }

    if (draft.amount.trim() === "") {
      continue
    }

    const parsedAmount = parseAmountInputValue(draft.amount)

    if (!isRecurringAmount(draft.amount) || parsedAmount === null) {
      errors[plan.planId] = AMOUNT_MESSAGE
      continue
    }

    items.push({
      planId: plan.planId,
      action: "fill",
      amount: parsedAmount.toNumber(),
      isEstimated: draft.isEstimated,
    })
  }

  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors }
  }

  return items.length === 0 ? { status: "empty" } : { status: "valid", items }
}
