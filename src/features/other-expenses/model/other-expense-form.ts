import { Decimal } from "decimal.js"
import type { FieldErrors, Resolver } from "react-hook-form"
import * as z from "zod"

import {
  formatAmountInputValue,
  parseAmountInputValue,
} from "@/shared/lib/amount-input"

export const CURRENCY_OPTIONS = ["ars", "usd"] as const

export type OtherExpenseCurrency = (typeof CURRENCY_OPTIONS)[number]

/**
 * RF-04: the payment method is optional and purely descriptive. «none» is the
 * visible way of leaving it empty, and «other» opens a free text field so the
 * three fixed chips never become a closed catalogue.
 */
export const PAYMENT_METHOD_OPTIONS = [
  "none",
  "debit",
  "transfer",
  "cash",
  "other",
] as const

export type PaymentMethodOption = (typeof PAYMENT_METHOD_OPTIONS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodOption, string> = {
  none: "Sin especificar",
  debit: "Débito",
  transfer: "Transferencia",
  cash: "Efectivo",
  other: "Otro",
}

const FIXED_PAYMENT_METHODS = ["debit", "transfer", "cash"] as const

type FixedPaymentMethod = (typeof FIXED_PAYMENT_METHODS)[number]

const CONCEPT_MESSAGE = "Ingresá el concepto del gasto"
const AMOUNT_MESSAGE = "Ingresá el importe del gasto, mayor a cero"
const CURRENCY_MESSAGE = "Elegí la moneda del gasto"
const PAYMENT_METHOD_MESSAGE = "Elegí un medio de pago o dejalo sin especificar"
const PAYMENT_METHOD_TEXT_MESSAGE = "Escribí con qué medio pagaste"

// An expense always moves money, so it cannot be zero.
export const isOtherExpenseAmount = (amount: string): boolean => {
  const parsedAmount = parseAmountInputValue(amount)

  return parsedAmount !== null && parsedAmount.greaterThan(0)
}

const otherExpenseFields = z.object({
  concept: z.string().trim().min(1, CONCEPT_MESSAGE),
  amount: z.string().refine(isOtherExpenseAmount, AMOUNT_MESSAGE),
  currency: z.enum(CURRENCY_OPTIONS, CURRENCY_MESSAGE),
  paymentMethod: z.enum(PAYMENT_METHOD_OPTIONS, PAYMENT_METHOD_MESSAGE),
  /** Only read when the chosen payment method is «other». */
  paymentMethodText: z.string(),
})

export type OtherExpenseFormValues = z.infer<typeof otherExpenseFields>

export const otherExpenseSchema = otherExpenseFields.superRefine(
  (values, ctx) => {
    if (
      values.paymentMethod === "other" &&
      values.paymentMethodText.trim() === ""
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethodText"],
        message: PAYMENT_METHOD_TEXT_MESSAGE,
      })
    }
  }
)

const isFixedPaymentMethod = (
  paymentMethod: PaymentMethodOption
): paymentMethod is FixedPaymentMethod =>
  FIXED_PAYMENT_METHODS.some((knownMethod) => knownMethod === paymentMethod)

/**
 * The column stores the descriptive text the user will read back, so the three
 * fixed chips travel as their own labels and «other» as whatever was typed.
 */
export const toStoredPaymentMethod = (
  values: OtherExpenseFormValues
): string | null => {
  if (values.paymentMethod === "none") {
    return null
  }

  if (isFixedPaymentMethod(values.paymentMethod)) {
    return PAYMENT_METHOD_LABELS[values.paymentMethod]
  }

  return values.paymentMethodText.trim()
}

export type PaymentMethodSelection = {
  paymentMethod: PaymentMethodOption
  paymentMethodText: string
}

/** Rebuilds the form selection from a stored payment method, for the edit. */
export const fromStoredPaymentMethod = (
  storedPaymentMethod: string | null
): PaymentMethodSelection => {
  if (storedPaymentMethod === null || storedPaymentMethod.trim() === "") {
    return { paymentMethod: "none", paymentMethodText: "" }
  }

  const fixedPaymentMethod = FIXED_PAYMENT_METHODS.find(
    (knownMethod) => PAYMENT_METHOD_LABELS[knownMethod] === storedPaymentMethod
  )

  if (fixedPaymentMethod !== undefined) {
    return { paymentMethod: fixedPaymentMethod, paymentMethodText: "" }
  }

  return { paymentMethod: "other", paymentMethodText: storedPaymentMethod }
}

/**
 * Prefills the amount field with the same AR display string AmountInput
 * produces, so a saved amount round-trips through the formatter.
 */
export const formatOtherExpenseAmountInput = (amount: number): string =>
  formatAmountInputValue(new Decimal(amount).toFixed(2).replace(".", ","))

// The project does not depend on @hookform/resolvers, so the Zod schema is
// bridged to react-hook-form by hand, like the loan and card purchase forms.
const OTHER_EXPENSE_FIELDS = [
  "concept",
  "amount",
  "currency",
  "paymentMethod",
  "paymentMethodText",
] as const

const isOtherExpenseField = (
  field: unknown
): field is keyof OtherExpenseFormValues =>
  OTHER_EXPENSE_FIELDS.some((knownField) => knownField === field)

export const otherExpenseResolver: Resolver<OtherExpenseFormValues> = (
  values
) => {
  const result = otherExpenseSchema.safeParse(values)

  if (result.success) {
    return { values: result.data, errors: {} }
  }

  const errors: FieldErrors<OtherExpenseFormValues> = {}

  for (const issue of result.error.issues) {
    const [field] = issue.path

    if (isOtherExpenseField(field) && errors[field] === undefined) {
      errors[field] = { type: issue.code, message: issue.message }
    }
  }

  return { values: {}, errors }
}
