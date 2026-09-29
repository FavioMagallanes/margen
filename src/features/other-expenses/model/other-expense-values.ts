import { parseAmountInputValue } from "@/shared/lib/amount-input"

import type { OtherExpenseValues } from "../api/other-expense-mutations"
import {
  type OtherExpenseFormValues,
  toStoredPaymentMethod,
} from "./other-expense-form"

/**
 * The stored shape of what the form holds as text. Shared by the create and
 * the edit dialogs, which differ only in which mutation they end up calling.
 */
export const toExpenseValues = (
  values: OtherExpenseFormValues
): OtherExpenseValues | null => {
  const amount = parseAmountInputValue(values.amount)

  // The resolver already rejected this case; this only narrows the type.
  if (amount === null) {
    return null
  }

  return {
    concept: values.concept,
    amount: amount.toNumber(),
    currency: values.currency,
    paymentMethod: toStoredPaymentMethod(values),
  }
}
