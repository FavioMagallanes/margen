import * as z from "zod"

import { parseAmountInputValue } from "@/shared/lib/amount-input"

import {
  type CardPurchaseCurrency,
  CURRENCY_OPTIONS,
  parsePositiveInteger,
} from "./card-purchase-form"

/**
 * RF-09 "carga de varios gastos": one item of the batch. The card and the
 * month are not here because the user chooses them once for the whole batch.
 */
export type CardPurchaseBatchItemValues = {
  concept: string
  currency: CardPurchaseCurrency
  quotaAmount: string
  startingInstallment: string
  totalInstallments: string
}

export type CardPurchaseBatchItem = {
  concept: string
  currency: CardPurchaseCurrency
  quotaAmount: number
  startingInstallment: number
  totalInstallments: number
}

const CONCEPT_MESSAGE = "Ingresá el concepto de la compra"
const CURRENCY_MESSAGE = "Elegí la moneda de la cuota"
const QUOTA_AMOUNT_MESSAGE = "Ingresá el importe de la cuota, mayor a cero"
const STARTING_INSTALLMENT_MESSAGE =
  "Ingresá un número de cuota entero y positivo"
const TOTAL_INSTALLMENTS_MESSAGE =
  "Ingresá un total de cuotas entero y positivo"
const INSTALLMENT_ORDER_MESSAGE =
  "La cuota inicial no puede superar el total de cuotas"

const isQuotaAmount = (quotaAmount: string): boolean => {
  const amount = parseAmountInputValue(quotaAmount)

  return amount !== null && amount.greaterThan(0)
}

const cardPurchaseBatchItemSchema = z
  .object({
    concept: z.string().trim().min(1, CONCEPT_MESSAGE),
    currency: z.enum(CURRENCY_OPTIONS, CURRENCY_MESSAGE),
    quotaAmount: z.string().refine(isQuotaAmount, QUOTA_AMOUNT_MESSAGE),
    startingInstallment: z.string(),
    totalInstallments: z.string(),
  })
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

const BATCH_ITEM_FIELDS = [
  "concept",
  "currency",
  "quotaAmount",
  "startingInstallment",
  "totalInstallments",
] as const

export type CardPurchaseBatchItemErrors = Partial<
  Record<(typeof BATCH_ITEM_FIELDS)[number], string>
>

const isBatchItemField = (
  field: unknown
): field is (typeof BATCH_ITEM_FIELDS)[number] =>
  BATCH_ITEM_FIELDS.some((knownField) => knownField === field)

export type CardPurchaseBatchItemResult =
  | { status: "valid"; item: CardPurchaseBatchItem }
  | { status: "invalid"; errors: CardPurchaseBatchItemErrors }

/**
 * The list keeps the raw values the user typed, so the same check runs when an
 * item is added and again for every item before the batch is confirmed.
 */
export const validateBatchItem = (
  values: CardPurchaseBatchItemValues
): CardPurchaseBatchItemResult => {
  const result = cardPurchaseBatchItemSchema.safeParse(values)

  if (!result.success) {
    const errors: CardPurchaseBatchItemErrors = {}

    for (const issue of result.error.issues) {
      const [field] = issue.path

      if (isBatchItemField(field) && errors[field] === undefined) {
        errors[field] = issue.message
      }
    }

    return { status: "invalid", errors }
  }

  const quotaAmount = parseAmountInputValue(result.data.quotaAmount)
  const startingInstallment = parsePositiveInteger(
    result.data.startingInstallment
  )
  const totalInstallments = parsePositiveInteger(result.data.totalInstallments)

  // The schema already rejected these cases; this only narrows the types.
  if (
    quotaAmount === null ||
    startingInstallment === null ||
    totalInstallments === null
  ) {
    return { status: "invalid", errors: {} }
  }

  return {
    status: "valid",
    item: {
      concept: result.data.concept,
      currency: result.data.currency,
      quotaAmount: quotaAmount.toNumber(),
      startingInstallment,
      totalInstallments,
    },
  }
}

export const emptyBatchItemValues = (): CardPurchaseBatchItemValues => ({
  concept: "",
  currency: "ars",
  quotaAmount: "",
  startingInstallment: "1",
  totalInstallments: "1",
})

export type CardPurchaseBatchValidation =
  | { status: "valid"; items: CardPurchaseBatchItem[] }
  | {
      status: "invalid"
      /** Errors by item position, so the list can point at the wrong one. */
      errorsByIndex: Record<number, CardPurchaseBatchItemErrors>
      invalidPositions: number[]
    }

/**
 * RF-09: the whole set is validated before confirming, so one wrong item stops
 * the batch instead of saving the rest.
 */
export const validateBatch = (
  values: readonly CardPurchaseBatchItemValues[]
): CardPurchaseBatchValidation => {
  const items: CardPurchaseBatchItem[] = []
  const errorsByIndex: Record<number, CardPurchaseBatchItemErrors> = {}
  const invalidPositions: number[] = []

  values.forEach((itemValues, index) => {
    const result = validateBatchItem(itemValues)

    if (result.status === "valid") {
      items.push(result.item)
      return
    }

    errorsByIndex[index] = result.errors
    invalidPositions.push(index + 1)
  })

  return invalidPositions.length === 0
    ? { status: "valid", items }
    : { status: "invalid", errorsByIndex, invalidPositions }
}

export const formatInvalidPositions = (positions: readonly number[]): string =>
  positions.length === 1
    ? `Revisá la compra ${positions[0]} de la lista: todavía tiene datos incompletos. No se guardó nada.`
    : `Revisá las compras ${positions.join(", ")} de la lista: todavía tienen datos incompletos. No se guardó nada.`
