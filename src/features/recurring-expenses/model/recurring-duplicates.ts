import type { DuplicateCandidate } from "@/shared/lib/duplicate-expense"

import type { CreateRecurringPlanInput } from "../model/recurring-expense-form"
import type { RecurringRow } from "./recurring-plans"

/** RF-09: a recurring expense is compared inside its own group. */
export const toRecurringDraftCandidate = (
  input: CreateRecurringPlanInput
): DuplicateCandidate => ({
  group: input.groupLabel,
  concept: input.concept,
  currency: input.currency,
  amount: input.startingAmount,
  // A recurring month is not an installment of a finite purchase.
  installment: null,
})

/**
 * A skipped month is an explicit absence and a month still waiting for its
 * amount cannot be told apart from the draft, so neither becomes a candidate.
 */
const toExistingCandidate = (row: RecurringRow): DuplicateCandidate | null =>
  row.isSkipped || row.amount === null
    ? null
    : {
        group: row.groupLabel,
        concept: row.concept,
        currency: row.currency,
        amount: row.amount,
        installment: null,
      }

export const toRecurringCandidates = (
  rows: readonly RecurringRow[]
): DuplicateCandidate[] =>
  rows
    .map(toExistingCandidate)
    .filter((candidate): candidate is DuplicateCandidate => candidate !== null)
