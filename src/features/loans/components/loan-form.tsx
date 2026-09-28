import { Controller, useForm } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  LOAN_ENTITY_SUGGESTIONS,
  type LoanFormValues,
  loanResolver,
} from "../model/loan-form"
import { Field, FieldError } from "./loan-field"

type LoanFormProps = {
  defaultValues: LoanFormValues
  /** The viewed month: a loan is always registered in the month on screen. */
  period: Period
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (values: LoanFormValues) => void
  /** RF-09: saves and keeps the form open, reset to its defaults. */
  onSubmitAndAddAnother: (values: LoanFormValues) => void
  onCancel: () => void
}

const ENTITY_SUGGESTIONS_ID = "loan-entity-suggestions"

export const LoanForm = ({
  defaultValues,
  period,
  isSaving,
  errorMessage,
  onSubmit,
  onSubmitAndAddAnother,
  onCancel,
}: LoanFormProps) => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoanFormValues>({ resolver: loanResolver, defaultValues })

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      aria-label="Nuevo préstamo"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="loan-concept" label="Concepto">
          <Input
            id="loan-concept"
            autoComplete="off"
            aria-invalid={errors.concept !== undefined}
            {...register("concept")}
          />
          <FieldError message={errors.concept?.message} />
        </Field>

        <Field htmlFor="loan-entity" label="Entidad">
          {/* RF-03: the entity is free text; the list only suggests. */}
          <Input
            id="loan-entity"
            autoComplete="off"
            list={ENTITY_SUGGESTIONS_ID}
            aria-invalid={errors.entity !== undefined}
            {...register("entity")}
          />
          <datalist id={ENTITY_SUGGESTIONS_ID}>
            {LOAN_ENTITY_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <FieldError message={errors.entity?.message} />
        </Field>

        <Field htmlFor="loan-quota-amount" label="Importe de la cuota (ARS)">
          <Controller
            control={control}
            name="quotaAmount"
            render={({ field }) => (
              <AmountInput
                id="loan-quota-amount"
                autoComplete="off"
                className="font-mono"
                aria-invalid={errors.quotaAmount !== undefined}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={(formattedValue) =>
                  field.onChange(formattedValue)
                }
              />
            )}
          />
          <FieldError message={errors.quotaAmount?.message} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="loan-starting-installment" label="Cuota que se carga">
          <Input
            id="loan-starting-installment"
            type="number"
            min={1}
            inputMode="numeric"
            aria-invalid={errors.startingInstallment !== undefined}
            {...register("startingInstallment")}
          />
          <FieldError message={errors.startingInstallment?.message} />
        </Field>

        <Field htmlFor="loan-total-installments" label="Total de cuotas">
          <Input
            id="loan-total-installments"
            type="number"
            min={1}
            inputMode="numeric"
            aria-invalid={errors.totalInstallments !== undefined}
            {...register("totalInstallments")}
          />
          <FieldError message={errors.totalInstallments?.message} />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        La cuota que cargás corresponde a {formatPeriodLabel(period)}. Las
        siguientes quedan sin importe hasta que las completes. Los préstamos
        solo admiten pesos.
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar préstamo"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isSaving}
          onClick={handleSubmit(onSubmitAndAddAnother)}
        >
          Guardar y agregar otro
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
