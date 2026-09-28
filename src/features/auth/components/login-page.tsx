import { useState } from "react"

import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"

import { type LoginFormValues, loginResolver } from "../model/login-form"
import { useAuth } from "../use-auth"

const SIGN_IN_ERROR_MESSAGE =
  "No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo."

const fieldClassName =
  "h-9 w-full rounded-md border border-border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

export const LoginPage = () => {
  const { signIn } = useAuth()
  const [hasFailed, setHasFailed] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: loginResolver,
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setHasFailed(false)

    const result = await signIn(email, password)

    // On success the auth listener updates the session and the guest guard
    // navigates away, so there is nothing to do here.
    if (result.status === "error") {
      setHasFailed(true)
    }
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
      <form
        noValidate
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold tracking-tight">Margen</h1>
          <p className="text-xs text-muted-foreground">
            Ingresá con tu email y contraseña para ver tu presupuesto.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-email" className="text-xs font-medium">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className={fieldClassName}
            aria-invalid={errors.email !== undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-password" className="text-xs font-medium">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className={fieldClassName}
            aria-invalid={errors.password !== undefined}
            {...register("password")}
          />
          {errors.password ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        {hasFailed ? (
          <p role="alert" className="text-xs text-destructive">
            {SIGN_IN_ERROR_MESSAGE}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </main>
  )
}
