import { Controller, useForm, useWatch } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  type RecurringEditFormValues,
  recurringEditResolver,
} from "../model/recurring-expense-form"
import { Field, FieldError, SelectField } from "./recurring-field"
import {
  amountModeOptions,
  currencyOptions,
  durationOptions,
  groupOptions,
} from "./recurring-options"

type RecurringExpenseEditFormProps = {
  defaultValues: RecurringEditFormValues
  /** The viewed month: a new fixed amount applies from there onwards (P-04). */
  editedPeriod: Period
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (values: RecurringEditFormValues) => void
  onCancel: () => void
}

export const RecurringExpenseEditForm = ({
  defaultValues,
  editedPeriod,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: RecurringExpenseEditFormProps) => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecurringEditFormValues>({
    resolver: recurringEditResolver,
    defaultValues,
  })

  const amountMode = useWatch({ control, name: "amountMode" })
  const duration = useWatch({ control, name: "duration" })

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      aria-label="Editar recurrente"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="recurring-edit-concept" label="Concepto">
          <Input
            id="recurring-edit-concept"
            autoComplete="off"
            aria-invalid={errors.concept !== undefined}
            {...register("concept")}
          />
          <FieldError message={errors.concept?.message} />
        </Field>

        <Field htmlFor="recurring-edit-group" label="Agrupación">
          <Controller
            control={control}
            name="groupLabel"
            render={({ field }) => (
              <SelectField
                id="recurring-edit-group"
                options={groupOptions}
                value={field.value}
                isInvalid={errors.groupLabel !== undefined}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <FieldError message={errors.groupLabel?.message} />
        </Field>

        <Field htmlFor="recurring-edit-currency" label="Moneda">
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <SelectField
                id="recurring-edit-currency"
                options={currencyOptions}
                value={field.value}
                isInvalid={errors.currency !== undefined}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <FieldError message={errors.currency?.message} />
        </Field>

        <Field htmlFor="recurring-edit-amount-mode" label="Tipo de importe">
          <Controller
            control={control}
            name="amountMode"
            render={({ field }) => (
              <SelectField
                id="recurring-edit-amount-mode"
                options={amountModeOptions}
                value={field.value}
                isInvalid={errors.amountMode !== undefined}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <FieldError message={errors.amountMode?.message} />
        </Field>

        {amountMode === "fixed" ? (
          <Field htmlFor="recurring-edit-default-amount" label="Importe fijo">
            <Controller
              control={control}
              name="defaultAmount"
              render={({ field }) => (
                <AmountInput
                  id="recurring-edit-default-amount"
                  autoComplete="off"
                  className="font-mono"
                  aria-invalid={errors.defaultAmount !== undefined}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={(formattedValue) =>
                    field.onChange(formattedValue)
                  }
                />
              )}
            />
            <FieldError message={errors.defaultAmount?.message} />
          </Field>
        ) : null}

        <Field htmlFor="recurring-edit-duration" label="Repetición">
          <Controller
            control={control}
            name="duration"
            render={({ field }) => (
              <SelectField
                id="recurring-edit-duration"
                options={durationOptions}
                value={field.value}
                isInvalid={errors.duration !== undefined}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <FieldError message={errors.duration?.message} />
        </Field>

        {duration === "months" ? (
          <Field
            htmlFor="recurring-edit-total-months"
            label="Cantidad de meses"
          >
            <Input
              id="recurring-edit-total-months"
              type="number"
              min={1}
              inputMode="numeric"
              aria-invalid={errors.totalMonths !== undefined}
              {...register("totalMonths")}
            />
            <FieldError message={errors.totalMonths?.message} />
          </Field>
        ) : null}
      </div>

      {/* The concept, the grouping and the currency are read from the plan by
          join, so they change every month at once. Only a new fixed amount is
          applied "desde este mes" (P-04). */}
      <p className="text-xs text-muted-foreground">
        El concepto, la agrupación y la moneda se actualizan en todos los meses.
        Un importe fijo nuevo se aplica desde {formatPeriodLabel(editedPeriod)}{" "}
        en adelante y no pisa los importes que hayas corregido a mano.
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
