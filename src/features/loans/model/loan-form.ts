import { Decimal } from "decimal.js"
import type { FieldErrors, Resolver } from "react-hook-form"
import * as z from "zod"

import {
  formatAmountInputValue,
  parseAmountInputValue,
} from "@/shared/lib/amount-input"

/**
 * RF-03 / D-08: the entity is free text. These are only the suggestions the
 * field offers, never a closed catalogue.
 */
export const LOAN_ENTITY_SUGGESTIONS = [
  "BBVA",
  "Supervielle",
  "Mercado Pago",
] as const

const CONCEPT_MESSAGE = "Ingresá el concepto del préstamo"
const ENTITY_MESSAGE = "Ingresá la entidad del préstamo"
const QUOTA_AMOUNT_MESSAGE = "Ingresá el importe de la cuota, mayor a cero"
const STARTING_INSTALLMENT_MESSAGE =
  "Ingresá un número de cuota entero y positivo"
const TOTAL_INSTALLMENTS_MESSAGE =
  "Ingresá un total de cuotas entero y positivo"
const INSTALLMENT_ORDER_MESSAGE =
  "La cuota inicial no puede superar el total de cuotas"
const EDITED_INSTALLMENT_ORDER_MESSAGE =
  "El total de cuotas no puede ser menor a la cuota que estás editando"

/** The installment fields travel as text, like every other input. */
export const parsePositiveInteger = (value: string): number | null => {
  const trimmedValue = value.trim()

  if (!/^\d+$/.test(trimmedValue)) {
    return null
  }

  const parsedValue = Number(trimmedValue)

  return parsedValue > 0 ? parsedValue : null
}

// An installment always moves money, so it cannot be zero.
export const isLoanAmount = (amount: string): boolean => {
  const parsedAmount = parseAmountInputValue(amount)

  return parsedAmount !== null && parsedAmount.greaterThan(0)
}

/**
 * Prefills an amount field with the same AR display string AmountInput
 * produces, so a saved amount round-trips through the formatter.
 */
export const formatLoanAmountInput = (amount: number): string =>
  formatAmountInputValue(new Decimal(amount).toFixed(2).replace(".", ","))

const loanFields = z.object({
  concept: z.string().trim().min(1, CONCEPT_MESSAGE),
  // RF-03: loans only admit ARS, so the form never asks for a currency.
  entity: z.string().trim().min(1, ENTITY_MESSAGE),
  quotaAmount: z.string().refine(isLoanAmount, QUOTA_AMOUNT_MESSAGE),
  startingInstallment: z.string(),
  totalInstallments: z.string(),
})

export type LoanFormValues = z.infer<typeof loanFields>

export const loanSchema = loanFields.superRefine((values, ctx) => {
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

const loanEditFields = z.object({
  concept: z.string().trim().min(1, CONCEPT_MESSAGE),
  entity: z.string().trim().min(1, ENTITY_MESSAGE),
  totalInstallments: z.string(),
  /**
   * The installment the user opened the edit from. It is not editable, but the
   * new total has to stay compatible with it (P-04: the edit applies from that
   * installment onwards).
   */
  editedInstallment: z.string(),
})

export type LoanEditFormValues = z.infer<typeof loanEditFields>

export const loanEditSchema = loanEditFields.superRefine((values, ctx) => {
  const totalInstallments = parsePositiveInteger(values.totalInstallments)
  const editedInstallment = parsePositiveInteger(values.editedInstallment)

  if (totalInstallments === null) {
    ctx.addIssue({
      code: "custom",
      path: ["totalInstallments"],
      message: TOTAL_INSTALLMENTS_MESSAGE,
    })

    return
  }

  if (editedInstallment !== null && editedInstallment > totalInstallments) {
    ctx.addIssue({
      code: "custom",
      path: ["totalInstallments"],
      message: EDITED_INSTALLMENT_ORDER_MESSAGE,
    })
  }
})

// The project does not depend on @hookform/resolvers, so each Zod schema is
// bridged to react-hook-form by hand, like the card purchase and salary forms.
const toResolver =
  <TValues extends Record<string, unknown>>(
    schema: z.ZodType<TValues, TValues>,
    fields: readonly (keyof TValues)[]
  ): Resolver<TValues> =>
  (values) => {
    const result = schema.safeParse(values)

    if (result.success) {
      return { values: result.data, errors: {} }
    }

    const errors: FieldErrors<TValues> = {}

    for (const issue of result.error.issues) {
      const [field] = issue.path
      const knownField = fields.find((candidate) => candidate === field)

      if (knownField !== undefined && errors[knownField] === undefined) {
        errors[knownField] = { type: issue.code, message: issue.message }
      }
    }

    return { values: {}, errors }
  }

export const loanResolver = toResolver<LoanFormValues>(loanSchema, [
  "concept",
  "entity",
  "quotaAmount",
  "startingInstallment",
  "totalInstallments",
])

export const loanEditResolver = toResolver<LoanEditFormValues>(loanEditSchema, [
  "concept",
  "entity",
  "totalInstallments",
  "editedInstallment",
])
