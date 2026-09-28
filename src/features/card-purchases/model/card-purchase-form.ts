import { Decimal } from "decimal.js"
import type { FieldErrors, Resolver } from "react-hook-form"
import * as z from "zod"

import {
  formatAmountInputValue,
  parseAmountInputValue,
} from "@/shared/lib/amount-input"

/** RF-02 / P-03: the two initial cards, no free-text card yet. */
export const CARD_OPTIONS = ["BBVA", "Supervielle"] as const

export type CardOption = (typeof CARD_OPTIONS)[number]

export const CURRENCY_OPTIONS = ["ars", "usd"] as const

export type CardPurchaseCurrency = (typeof CURRENCY_OPTIONS)[number]

const CONCEPT_MESSAGE = "Ingresá el concepto de la compra"
const CARD_MESSAGE = "Elegí la tarjeta de la compra"
const CURRENCY_MESSAGE = "Elegí la moneda de la cuota"
const QUOTA_AMOUNT_MESSAGE = "Ingresá el importe de la cuota, mayor a cero"
const STARTING_INSTALLMENT_MESSAGE =
  "Ingresá un número de cuota entero y positivo"
const TOTAL_INSTALLMENTS_MESSAGE =
  "Ingresá un total de cuotas entero y positivo"
const INSTALLMENT_ORDER_MESSAGE =
  "La cuota inicial no puede superar el total de cuotas"
const MONTH_MESSAGE = "Elegí el mes de la cuota"

const MONTHS_PER_YEAR = 12

/** The installment and month fields travel as text, like every other input. */
export const parsePositiveInteger = (value: string): number | null => {
  const trimmedValue = value.trim()

  if (!/^\d+$/.test(trimmedValue)) {
    return null
  }

  const parsedValue = Number(trimmedValue)

  return parsedValue > 0 ? parsedValue : null
}

// A purchase always moves money, so its quota cannot be zero (unlike a salary).
const isQuotaAmount = (quotaAmount: string): boolean => {
  const amount = parseAmountInputValue(quotaAmount)

  return amount !== null && amount.greaterThan(0)
}

// RF-02: the year is always the current one, so the form never asks for it and
// only the calendar bound is validated here; which months are actually offered
// depends on today's date and belongs to the component, not to this pure schema.
const isMonth = (month: string): boolean => {
  const parsedMonth = parsePositiveInteger(month)

  return parsedMonth !== null && parsedMonth <= MONTHS_PER_YEAR
}

const cardPurchaseFields = z.object({
  concept: z.string().trim().min(1, CONCEPT_MESSAGE),
  card: z.enum(CARD_OPTIONS, CARD_MESSAGE),
  currency: z.enum(CURRENCY_OPTIONS, CURRENCY_MESSAGE),
  quotaAmount: z.string().refine(isQuotaAmount, QUOTA_AMOUNT_MESSAGE),
  isSinglePayment: z.boolean(),
  startingInstallment: z.string(),
  totalInstallments: z.string(),
  month: z.string().refine(isMonth, MONTH_MESSAGE),
})

export type CardPurchaseFormValues = z.infer<typeof cardPurchaseFields>

// RF-02: «Un pago» is the shortcut for cuota 1 de 1, so it decides both
// installment fields instead of asking the user to type them.
const applySinglePaymentShortcut = (
  values: CardPurchaseFormValues
): CardPurchaseFormValues =>
  values.isSinglePayment
    ? { ...values, startingInstallment: "1", totalInstallments: "1" }
    : values

export const cardPurchaseSchema = cardPurchaseFields
  .transform(applySinglePaymentShortcut)
  .superRefine((values, ctx) => {
    const startingInstallment = parsePositiveInteger(values.startingInstallment)
    const totalInstallments = parsePositiveInteger(values.totalInstallments)

    if (startingInstallment === null) {
      ctx.addIssue({
        code: "custom",
        path: ["startingInstallment"],
        message: STARTING_INSTALLMENT_MESSAGE,
      })
    }

    if (totalInstallments === null) {
      ctx.addIssue({
        code: "custom",
        path: ["totalInstallments"],
        message: TOTAL_INSTALLMENTS_MESSAGE,
      })
    }

    if (
      startingInstallment !== null &&
      totalInstallments !== null &&
      startingInstallment > totalInstallments
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["startingInstallment"],
        message: INSTALLMENT_ORDER_MESSAGE,
      })
    }
  })

/**
 * Prefills the quota field with the same AR display string AmountInput
 * produces, so an already saved purchase round-trips through the formatter.
 */
export const formatQuotaAmountInput = (quotaAmount: number): string =>
  formatAmountInputValue(new Decimal(quotaAmount).toFixed(2).replace(".", ","))

const CARD_PURCHASE_FIELDS = [
  "concept",
  "card",
  "currency",
  "quotaAmount",
  "isSinglePayment",
  "startingInstallment",
  "totalInstallments",
  "month",
] as const

const isCardPurchaseField = (
  field: unknown
): field is keyof CardPurchaseFormValues =>
  CARD_PURCHASE_FIELDS.some((knownField) => knownField === field)

// The project does not depend on @hookform/resolvers, so the Zod schema is
// bridged to react-hook-form by hand, like the salary and login forms do.
export const cardPurchaseResolver: Resolver<CardPurchaseFormValues> = (
  values
) => {
  const result = cardPurchaseSchema.safeParse(values)

  if (result.success) {
    return { values: result.data, errors: {} }
  }

  const errors: FieldErrors<CardPurchaseFormValues> = {}

  for (const issue of result.error.issues) {
    const [field] = issue.path

    if (isCardPurchaseField(field) && errors[field] === undefined) {
      errors[field] = { type: issue.code, message: issue.message }
    }
  }

  return { values: {}, errors }
}
