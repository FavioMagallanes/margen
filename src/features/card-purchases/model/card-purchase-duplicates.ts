import {
  type DuplicateCandidate,
  formatInstallment,
} from "@/shared/lib/duplicate-expense"

import type { CreateCardPurchaseInput } from "../api/card-purchase-mutations"
import type { CardPurchaseRow } from "./card-purchase-groups"

/** RF-09: a card purchase is compared inside its own card. */
export const toCardPurchaseDraftCandidate = (
  input: CreateCardPurchaseInput
): DuplicateCandidate => ({
  group: input.card,
  concept: input.concept,
  currency: input.currency,
  amount: input.quotaAmount,
  installment: formatInstallment(
    input.startingInstallment,
    input.totalInstallments
  ),
})

/**
 * A row without amount or with an unsupported currency cannot be told apart
 * from the draft, so it is left out instead of warning about a guess.
 */
const toExistingCandidate = (
  row: CardPurchaseRow
): DuplicateCandidate | null => {
  if (row.amount === null || row.currency === null) {
    return null
  }

  return {
    group: row.card,
    concept: row.conceptText,
    currency: row.currency,
    amount: row.amount,
    installment: formatInstallment(
      row.installmentNumber,
      row.totalInstallments
    ),
  }
}

export const toCardPurchaseCandidates = (
  rows: readonly CardPurchaseRow[]
): DuplicateCandidate[] =>
  rows
    .map(toExistingCandidate)
    .filter((candidate): candidate is DuplicateCandidate => candidate !== null)
