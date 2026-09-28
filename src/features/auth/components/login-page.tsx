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
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      {/* Subtle accent wash built from theme tokens; purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_70%)]"
      />

      <form
        noValidate
        onSubmit={onSubmit}
        className="relative flex w-full max-w-sm flex-col gap-6 rounded-xl border border-border bg-card p-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/margen-web.svg"
            alt=""
            aria-hidden="true"
            className="size-12 rounded-[0.6rem]"
          />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Margen</h1>
            <p className="text-xs leading-relaxed text-balance text-muted-foreground">
              Ingresá con tu email y contraseña para ver tu presupuesto.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
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
        </div>

        {hasFailed ? (
          <p role="alert" className="text-xs text-destructive">
            {SIGN_IN_ERROR_MESSAGE}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </main>
  )
}
