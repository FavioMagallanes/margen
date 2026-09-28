import { Decimal } from "decimal.js"
import type { FieldErrors, Resolver } from "react-hook-form"
import * as z from "zod"

import {
  formatAmountInputValue,
  parseAmountInputValue,
} from "@/shared/lib/amount-input"

const SALARY_MESSAGE =
  "Ingresá un importe en pesos, sin signos y hasta 2 decimales"

// A salary is either unset (handled outside the form) or zero or more.
const isSalaryAmount = (salary: string): boolean => {
  const amount = parseAmountInputValue(salary)

  return amount !== null && amount.greaterThanOrEqualTo(0)
}

export const salarySchema = z.object({
  salary: z.string().refine(isSalaryAmount, SALARY_MESSAGE),
})

export type SalaryFormValues = z.infer<typeof salarySchema>

/**
 * Prefills the field with the same AR display string AmountInput produces, so
 * an already saved salary round-trips through the shared formatter.
 */
export const formatSalaryInput = (salaryArs: number): string =>
  formatAmountInputValue(new Decimal(salaryArs).toFixed(2).replace(".", ","))

const isSalaryField = (field: unknown): field is keyof SalaryFormValues =>
  field === "salary"

// The project does not depend on @hookform/resolvers, so the Zod schema is
// bridged to react-hook-form by hand, like the login form already does.
export const salaryResolver: Resolver<SalaryFormValues> = (values) => {
  const result = salarySchema.safeParse(values)

  if (result.success) {
    return { values: result.data, errors: {} }
  }

  const errors: FieldErrors<SalaryFormValues> = {}

  for (const issue of result.error.issues) {
    const [field] = issue.path

    if (isSalaryField(field) && errors[field] === undefined) {
      errors[field] = { type: issue.code, message: issue.message }
    }
  }

  return { values: {}, errors }
}
