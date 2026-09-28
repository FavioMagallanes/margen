import { parseAmountInputValue } from "@/shared/lib/amount-input"

import { isLoanAmount } from "./loan-form"

/** An installment still waiting for its amount, as the batch form lists it. */
export type PendingLoanInstallment = {
  occurrenceId: string
  year: number
  month: number
  installmentNumber: number | null
}

export type LoanInstallmentAmount = {
  occurrenceId: string
  amount: number
}

/**
 * RF-03: the batch form lets the user complete only the installments whose
 * amount is already known, so a blank field is a skipped installment and not
 * an error. "empty" keeps «no completé nada» apart from «completé algo mal».
 */
export type LoanInstallmentAmountsResult =
  | { status: "valid"; amounts: LoanInstallmentAmount[] }
  | { status: "empty" }
  | { status: "invalid"; errors: Record<string, string> }

const AMOUNT_MESSAGE = "Ingresá un importe mayor a cero o dejá la cuota vacía"

export const parseLoanInstallmentAmounts = (
  draftAmounts: Readonly<Record<string, string>>
): LoanInstallmentAmountsResult => {
  const amounts: LoanInstallmentAmount[] = []
  const errors: Record<string, string> = {}

  for (const [occurrenceId, draftAmount] of Object.entries(draftAmounts)) {
    if (draftAmount.trim() === "") {
      continue
    }

    const parsedAmount = parseAmountInputValue(draftAmount)

    if (!isLoanAmount(draftAmount) || parsedAmount === null) {
      errors[occurrenceId] = AMOUNT_MESSAGE
      continue
    }

    amounts.push({ occurrenceId, amount: parsedAmount.toNumber() })
  }

  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors }
  }

  return amounts.length === 0
    ? { status: "empty" }
    : { status: "valid", amounts }
}
