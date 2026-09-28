import { Decimal } from "decimal.js"
import type { FieldErrors, Resolver } from "react-hook-form"
import * as z from "zod"

const SALARY_MESSAGE =
  "Ingresá un importe en pesos, sin signos y hasta 2 decimales"

// Only non-negative amounts: a salary is either unset (null) or zero or more.
const SALARY_PATTERN = /^\d{1,12}([.,]\d{1,2})?$/

export const salarySchema = z.object({
  salary: z.string().trim().regex(SALARY_PATTERN, SALARY_MESSAGE),
})

export type SalaryFormValues = z.infer<typeof salarySchema>

export const parseSalaryArs = (salary: string): number =>
  new Decimal(salary.trim().replace(",", ".")).toNumber()

export const formatSalaryInput = (salaryArs: number): string =>
  new Decimal(salaryArs).toFixed(2)

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
