import { Controller, useForm } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  LOAN_ENTITY_SUGGESTIONS,
  type LoanEditFormValues,
  loanEditResolver,
} from "../model/loan-form"
import { Field, FieldError } from "./loan-field"

type LoanEditFormProps = {
  defaultValues: LoanEditFormValues
  /** The month of the edited row: the edit applies from there onwards (P-04). */
  editedPeriod: Period
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (values: LoanEditFormValues) => void
  onCancel: () => void
}

const ENTITY_SUGGESTIONS_ID = "loan-edit-entity-suggestions"

export const LoanEditForm = ({
  defaultValues,
  editedPeriod,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: LoanEditFormProps) => {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoanEditFormValues>({
    resolver: loanEditResolver,
    defaultValues,
  })

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      aria-label="Editar préstamo"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="loan-edit-concept" label="Concepto">
          <Input
            id="loan-edit-concept"
            autoComplete="off"
            aria-invalid={errors.concept !== undefined}
            {...register("concept")}
          />
          <FieldError message={errors.concept?.message} />
        </Field>

        <Field htmlFor="loan-edit-entity" label="Entidad">
          <Input
            id="loan-edit-entity"
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

        <Field htmlFor="loan-edit-total-installments" label="Total de cuotas">
          <Input
            id="loan-edit-total-installments"
            type="number"
            min={1}
            inputMode="numeric"
            aria-invalid={errors.totalInstallments !== undefined}
            {...register("totalInstallments")}
          />
          <FieldError message={errors.totalInstallments?.message} />
        </Field>

        <Field htmlFor="loan-edit-quota-amount" label="Importe de esta cuota">
          <Controller
            control={control}
            name="quotaAmount"
            render={({ field }) => (
              <AmountInput
                id="loan-edit-quota-amount"
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
          <p className="text-xs text-muted-foreground">
            Si lo dejás vacío, no se toca el importe ya cargado. Solo cambia
            esta cuota, no las demás del préstamo.
          </p>
          <FieldError message={errors.quotaAmount?.message} />
        </Field>
      </div>

      {/* P-04 for loans: the reschedule starts at the edited installment, and
          the amounts already entered are never rewritten. */}
      <p className="text-xs text-muted-foreground">
        Los cambios se aplican desde la cuota {defaultValues.editedInstallment}{" "}
        de {formatPeriodLabel(editedPeriod)} en adelante. Los meses anteriores y
        los importes que ya cargaste no se modifican.
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar cambios"}
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
