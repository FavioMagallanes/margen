import { Decimal } from "decimal.js"
import type { FieldErrors, Resolver } from "react-hook-form"
import * as z from "zod"

import { CARD_OPTIONS } from "@/features/card-purchases/model/card-purchase-form"
import {
  formatAmountInputValue,
  parseAmountInputValue,
} from "@/shared/lib/amount-input"

/**
 * RF-05: a recurring expense shares the subtotal of the card it belongs to, or
 * the one of the one-off expenses when it has no card. This literal has to
 * stay equal to OTHER_EXPENSES_GROUP in monthly-budget-queries, which is what
 * labels the other_expenses lines of the month summary.
 */
export const OTHER_EXPENSES_GROUP = "Otros gastos"

/** A closed list: this feature never takes a free-text group. */
export const RECURRING_GROUP_OPTIONS = [
  ...CARD_OPTIONS,
  OTHER_EXPENSES_GROUP,
] as const

export const RECURRING_CURRENCY_OPTIONS = ["ars", "usd"] as const

/** Null default_amount means "importe variable": nothing to repeat monthly. */
export const RECURRING_AMOUNT_MODE_OPTIONS = ["fixed", "variable"] as const

/**
 * "once" and "months" both store a total_installments; "untilStopped" stores
 * null, which is what makes the plan have no known end.
 */
export const RECURRING_DURATION_OPTIONS = [
  "once",
  "months",
  "untilStopped",
] as const

export type RecurringGroup = (typeof RECURRING_GROUP_OPTIONS)[number]

export type RecurringCurrency = (typeof RECURRING_CURRENCY_OPTIONS)[number]

export type RecurringAmountMode = (typeof RECURRING_AMOUNT_MODE_OPTIONS)[number]

export type RecurringDuration = (typeof RECURRING_DURATION_OPTIONS)[number]

/**
 * The stored group and currency are plain text columns, so a row only fits the
 * edit form when its values are still part of the closed lists it offers.
 */
export const isRecurringGroup = (value: string): value is RecurringGroup =>
  RECURRING_GROUP_OPTIONS.some((option) => option === value)

export const isRecurringCurrency = (
  value: string
): value is RecurringCurrency =>
  RECURRING_CURRENCY_OPTIONS.some((option) => option === value)

const CONCEPT_MESSAGE = "Ingresá el concepto del recurrente"
const GROUP_MESSAGE = "Elegí dónde se agrupa el recurrente"
const CURRENCY_MESSAGE = "Elegí la moneda del recurrente"
const AMOUNT_MODE_MESSAGE = "Elegí si el importe es fijo o variable"
const DURATION_MESSAGE = "Elegí cuántas veces se repite"
const STARTING_AMOUNT_MESSAGE = "Ingresá el importe de este mes, mayor a cero"
const DEFAULT_AMOUNT_MESSAGE = "Ingresá el importe fijo, mayor a cero"
const TOTAL_MONTHS_MESSAGE = "Ingresá una cantidad de meses entera y positiva"

/** The months field travels as text, like every other input. */
export const parsePositiveInteger = (value: string): number | null => {
  const trimmedValue = value.trim()

  if (!/^\d+$/.test(trimmedValue)) {
    return null
  }

  const parsedValue = Number(trimmedValue)

  return parsedValue > 0 ? parsedValue : null
}

// A recurring appearance always moves money, so it cannot be zero.
export const isRecurringAmount = (amount: string): boolean => {
  const parsedAmount = parseAmountInputValue(amount)

  return parsedAmount !== null && parsedAmount.greaterThan(0)
}

/**
 * Prefills an amount field with the same AR display string AmountInput
 * produces, so a saved amount round-trips through the formatter.
 */
export const formatRecurringAmountInput = (amount: number): string =>
  formatAmountInputValue(new Decimal(amount).toFixed(2).replace(".", ","))

const durationFields = {
  duration: z.enum(RECURRING_DURATION_OPTIONS, DURATION_MESSAGE),
  totalMonths: z.string(),
}

const recurringFields = z.object({
  concept: z.string().trim().min(1, CONCEPT_MESSAGE),
  groupLabel: z.enum(RECURRING_GROUP_OPTIONS, GROUP_MESSAGE),
  currency: z.enum(RECURRING_CURRENCY_OPTIONS, CURRENCY_MESSAGE),
  amountMode: z.enum(RECURRING_AMOUNT_MODE_OPTIONS, AMOUNT_MODE_MESSAGE),
  // The first month always carries a real amount, even for a variable plan:
  // it is the month the user is standing on while loading it.
  startingAmount: z.string().refine(isRecurringAmount, STARTING_AMOUNT_MESSAGE),
  ...durationFields,
})

export type RecurringFormValues = z.infer<typeof recurringFields>

const checkTotalMonths = (
  values: { duration: RecurringDuration; totalMonths: string },
  ctx: z.RefinementCtx
) => {
  if (
    values.duration === "months" &&
    parsePositiveInteger(values.totalMonths) === null
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["totalMonths"],
      message: TOTAL_MONTHS_MESSAGE,
    })
  }
}

export const recurringSchema = recurringFields.superRefine(checkTotalMonths)

const recurringEditFields = z.object({
  concept: z.string().trim().min(1, CONCEPT_MESSAGE),
  groupLabel: z.enum(RECURRING_GROUP_OPTIONS, GROUP_MESSAGE),
  currency: z.enum(RECURRING_CURRENCY_OPTIONS, CURRENCY_MESSAGE),
  amountMode: z.enum(RECURRING_AMOUNT_MODE_OPTIONS, AMOUNT_MODE_MESSAGE),
  /** Only meaningful when the plan keeps a fixed amount. */
  defaultAmount: z.string(),
  ...durationFields,
})

export type RecurringEditFormValues = z.infer<typeof recurringEditFields>

export const recurringEditSchema = recurringEditFields.superRefine(
  (values, ctx) => {
    checkTotalMonths(values, ctx)

    if (
      values.amountMode === "fixed" &&
      !isRecurringAmount(values.defaultAmount)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultAmount"],
        message: DEFAULT_AMOUNT_MESSAGE,
      })
    }
  }
)

/** What the plan stores, once the text fields became domain values. */
export type RecurringPlanInput = {
  concept: string
  groupLabel: string
  currency: string
  /** Null for a variable amount: there is no value to repeat every month. */
  defaultAmount: number | null
  /** Null for "mensual hasta detener". */
  totalInstallments: number | null
}

export type CreateRecurringPlanInput = RecurringPlanInput & {
  startingAmount: number
}

const toTotalInstallments = (
  duration: RecurringDuration,
  totalMonths: string
): number | null | "invalid" => {
  if (duration === "untilStopped") {
    return null
  }

  if (duration === "once") {
    return 1
  }

  return parsePositiveInteger(totalMonths) ?? "invalid"
}

/**
 * Both conversions return null when a value the resolver already rejected
 * reaches them: they only narrow types, they do not validate again.
 */
export const toCreateRecurringPlanInput = (
  values: RecurringFormValues
): CreateRecurringPlanInput | null => {
  const startingAmount = parseAmountInputValue(values.startingAmount)
  const totalInstallments = toTotalInstallments(
    values.duration,
    values.totalMonths
  )

  if (startingAmount === null || totalInstallments === "invalid") {
    return null
  }

  return {
    concept: values.concept,
    groupLabel: values.groupLabel,
    currency: values.currency,
    // A fixed plan repeats the very amount loaded for the first month.
    defaultAmount:
      values.amountMode === "fixed" ? startingAmount.toNumber() : null,
    totalInstallments,
    startingAmount: startingAmount.toNumber(),
  }
}

export const toRecurringPlanInput = (
  values: RecurringEditFormValues
): RecurringPlanInput | null => {
  const totalInstallments = toTotalInstallments(
    values.duration,
    values.totalMonths
  )

  if (totalInstallments === "invalid") {
    return null
  }

  const defaultAmount =
    values.amountMode === "fixed"
      ? parseAmountInputValue(values.defaultAmount)
      : null

  if (values.amountMode === "fixed" && defaultAmount === null) {
    return null
  }

  return {
    concept: values.concept,
    groupLabel: values.groupLabel,
    currency: values.currency,
    defaultAmount: defaultAmount?.toNumber() ?? null,
    totalInstallments,
  }
}

// The project does not depend on @hookform/resolvers, so each Zod schema is
// bridged to react-hook-form by hand, like every other form of the app.
const RECURRING_FIELDS = [
  "concept",
  "groupLabel",
  "currency",
  "amountMode",
  "startingAmount",
  "duration",
  "totalMonths",
] as const

const isRecurringField = (field: unknown): field is keyof RecurringFormValues =>
  RECURRING_FIELDS.some((knownField) => knownField === field)

export const recurringResolver: Resolver<RecurringFormValues> = (values) => {
  const result = recurringSchema.safeParse(values)

  if (result.success) {
    return { values: result.data, errors: {} }
  }

  const errors: FieldErrors<RecurringFormValues> = {}

  for (const issue of result.error.issues) {
    const [field] = issue.path

    if (isRecurringField(field) && errors[field] === undefined) {
      errors[field] = { type: issue.code, message: issue.message }
    }
  }

  return { values: {}, errors }
}

const RECURRING_EDIT_FIELDS = [
  "concept",
  "groupLabel",
  "currency",
  "amountMode",
  "defaultAmount",
  "duration",
  "totalMonths",
] as const

const isRecurringEditField = (
  field: unknown
): field is keyof RecurringEditFormValues =>
  RECURRING_EDIT_FIELDS.some((knownField) => knownField === field)

export const recurringEditResolver: Resolver<RecurringEditFormValues> = (
  values
) => {
  const result = recurringEditSchema.safeParse(values)

  if (result.success) {
    return { values: result.data, errors: {} }
  }

  const errors: FieldErrors<RecurringEditFormValues> = {}

  for (const issue of result.error.issues) {
    const [field] = issue.path

    if (isRecurringEditField(field) && errors[field] === undefined) {
      errors[field] = { type: issue.code, message: issue.message }
    }
  }

  return { values: {}, errors }
}
