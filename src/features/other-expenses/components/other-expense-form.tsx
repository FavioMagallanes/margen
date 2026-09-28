import type { ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  CURRENCY_OPTIONS,
  type OtherExpenseFormValues,
  otherExpenseResolver,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
} from "../model/other-expense-form"

type OtherExpenseFormProps = {
  mode: "create" | "edit"
  defaultValues: OtherExpenseFormValues
  /** Concepts already written by the user; they suggest, never restrict. */
  conceptSuggestions: readonly string[]
  /** The viewed month: an expense is always imputed to the month on screen. */
  period: Period
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (values: OtherExpenseFormValues) => void
  onCancel: () => void
}

const CONCEPT_SUGGESTIONS_ID = "other-expense-concept-suggestions"

const CURRENCY_LABELS: Record<(typeof CURRENCY_OPTIONS)[number], string> = {
  ars: "Pesos (ARS)",
  usd: "Dólares (USD)",
}

const Field = ({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string
  label: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={htmlFor} className="text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
)

const FieldError = ({ message }: { message: string | undefined }) =>
  message === undefined ? null : (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )

type Choice = {
  value: string
  label: string
}

/**
 * RF-04: currency and payment method are short, closed lists, and the
 * functional spec asks for visible options instead of a dropdown, so both use
 * the same radio group of chips.
 */
const ChoiceField = ({
  name,
  label,
  choices,
  value,
  onValueChange,
  onBlur,
}: {
  name: string
  label: string
  choices: readonly Choice[]
  value: string
  onValueChange: (value: string) => void
  onBlur: () => void
}) => (
  <div className="flex flex-col gap-1.5">
    <span id={`${name}-label`} className="text-sm text-muted-foreground">
      {label}
    </span>
    <RadioGroup
      aria-labelledby={`${name}-label`}
      value={value}
      onValueChange={(selectedValue) => {
        if (typeof selectedValue === "string") {
          onValueChange(selectedValue)
        }
      }}
      onBlur={onBlur}
      className="flex flex-wrap gap-x-4 gap-y-2"
    >
      {choices.map((choice) => (
        <span key={choice.value} className="flex items-center gap-2">
          <RadioGroupItem id={`${name}-${choice.value}`} value={choice.value} />
          <Label htmlFor={`${name}-${choice.value}`}>{choice.label}</Label>
        </span>
      ))}
    </RadioGroup>
  </div>
)

const currencyChoices: Choice[] = CURRENCY_OPTIONS.map((currency) => ({
  value: currency,
  label: CURRENCY_LABELS[currency],
}))

const paymentMethodChoices: Choice[] = PAYMENT_METHOD_OPTIONS.map(
  (paymentMethod) => ({
    value: paymentMethod,
    label: PAYMENT_METHOD_LABELS[paymentMethod],
  })
)

export const OtherExpenseForm = ({
  mode,
  defaultValues,
  conceptSuggestions,
  period,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: OtherExpenseFormProps) => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtherExpenseFormValues>({
    resolver: otherExpenseResolver,
    defaultValues,
  })

  const paymentMethod = useWatch({ control, name: "paymentMethod" })
  const isCreating = mode === "create"

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      aria-label={isCreating ? "Nuevo gasto" : "Editar gasto"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="other-expense-concept" label="Concepto">
          <Input
            id="other-expense-concept"
            autoComplete="off"
            list={CONCEPT_SUGGESTIONS_ID}
            aria-invalid={errors.concept !== undefined}
            {...register("concept")}
          />
          <datalist id={CONCEPT_SUGGESTIONS_ID}>
            {conceptSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <FieldError message={errors.concept?.message} />
        </Field>

        <Field htmlFor="other-expense-amount" label="Importe">
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <AmountInput
                id="other-expense-amount"
                autoComplete="off"
                className="font-mono"
                aria-invalid={errors.amount !== undefined}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={(formattedValue) =>
                  field.onChange(formattedValue)
                }
              />
            )}
          />
          <FieldError message={errors.amount?.message} />
        </Field>
      </div>

      <Controller
        control={control}
        name="currency"
        render={({ field }) => (
          <ChoiceField
            name="other-expense-currency"
            label="Moneda"
            choices={currencyChoices}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <FieldError message={errors.currency?.message} />

      <Controller
        control={control}
        name="paymentMethod"
        render={({ field }) => (
          <ChoiceField
            name="other-expense-payment-method"
            label="Medio de pago (opcional)"
            choices={paymentMethodChoices}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />

      {paymentMethod === "other" ? (
        <Field htmlFor="other-expense-payment-method-text" label="¿Cuál?">
          <Input
            id="other-expense-payment-method-text"
            autoComplete="off"
            aria-invalid={errors.paymentMethodText !== undefined}
            {...register("paymentMethodText")}
          />
          <FieldError message={errors.paymentMethodText?.message} />
        </Field>
      ) : null}

      <p className="text-xs text-muted-foreground">
        El gasto se imputa a {formatPeriodLabel(period)}. El medio de pago es
        solo descriptivo: no registra pagos ni saldos.
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving
            ? "Guardando…"
            : isCreating
              ? "Guardar gasto"
              : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isSaving}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>

      {errorMessage === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
