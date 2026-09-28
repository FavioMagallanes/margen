import type { DuplicateCandidate } from "@/shared/lib/duplicate-expense"

import type { OtherExpenseValues } from "../api/other-expense-mutations"
import type { OtherExpenseRow } from "../api/other-expense-queries"

/**
 * RF-09: these expenses have no card or entity to group by, so they are all
 * compared against each other inside the month on screen.
 */
const OTHER_EXPENSES_GROUP = "Otros gastos"

export const toOtherExpenseDraftCandidate = (
  values: OtherExpenseValues
): DuplicateCandidate => ({
  group: OTHER_EXPENSES_GROUP,
  concept: values.concept,
  currency: values.currency,
  amount: values.amount,
  // A one-off expense has no installment at all.
  installment: null,
})

/**
 * The currency is stored as free text, so a row with an unsupported one cannot
 * be told apart from the draft and is left out instead of warning on a guess.
 */
const toExistingCandidate = (
  row: OtherExpenseRow
): DuplicateCandidate | null =>
  row.currency === null
    ? null
    : {
        group: OTHER_EXPENSES_GROUP,
        concept: row.concept,
        currency: row.currency,
        amount: row.amount,
        installment: null,
      }

export const toOtherExpenseCandidates = (
  rows: readonly OtherExpenseRow[]
): DuplicateCandidate[] =>
  rows
    .map(toExistingCandidate)
    .filter((candidate): candidate is DuplicateCandidate => candidate !== null)
