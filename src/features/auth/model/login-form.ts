import type { FieldErrors, Resolver } from "react-hook-form"
import * as z from "zod"

export const loginSchema = z.object({
  email: z.email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
})

export type LoginFormValues = z.infer<typeof loginSchema>

const isLoginField = (field: unknown): field is keyof LoginFormValues =>
  field === "email" || field === "password"

// The project does not depend on @hookform/resolvers, so the Zod schema is
// bridged to react-hook-form here instead of adding a package for one form.
export const loginResolver: Resolver<LoginFormValues> = (values) => {
  const result = loginSchema.safeParse(values)

  if (result.success) {
    return { values: result.data, errors: {} }
  }

  const errors: FieldErrors<LoginFormValues> = {}

  for (const issue of result.error.issues) {
    const [field] = issue.path

    if (isLoginField(field) && errors[field] === undefined) {
      errors[field] = { type: issue.code, message: issue.message }
    }
  }

  return { values: {}, errors }
}
