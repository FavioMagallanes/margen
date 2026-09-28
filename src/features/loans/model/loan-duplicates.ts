import {
  type DuplicateCandidate,
  formatInstallment,
} from "@/shared/lib/duplicate-expense"

import type { CreateLoanInput } from "../api/loan-mutations"
import type { LoanRow } from "./loan-rows"

/** RF-03: loans only admit pesos, so the currency is never in doubt here. */
const LOAN_CURRENCY = "ars"

/** RF-09: a loan is compared inside its own entity. */
export const toLoanDraftCandidate = (
  input: CreateLoanInput
): DuplicateCandidate => ({
  group: input.entity,
  concept: input.concept,
  currency: LOAN_CURRENCY,
  amount: input.quotaAmount,
  installment: formatInstallment(
    input.startingInstallment,
    input.totalInstallments
  ),
})

/**
 * An installment still waiting for its amount (RF-03) cannot be told apart
 * from the draft, so it is left out instead of warning about a guess.
 */
const toExistingCandidate = (row: LoanRow): DuplicateCandidate | null =>
  row.amount === null
    ? null
    : {
        group: row.entity,
        concept: row.conceptText,
        currency: LOAN_CURRENCY,
        amount: row.amount,
        installment: formatInstallment(
          row.installmentNumber,
          row.totalInstallments
        ),
      }

export const toLoanCandidates = (
  rows: readonly LoanRow[]
): DuplicateCandidate[] =>
  rows
    .map(toExistingCandidate)
    .filter((candidate): candidate is DuplicateCandidate => candidate !== null)
