import { Controller, useForm, useWatch } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  type RecurringFormValues,
  recurringResolver,
} from "../model/recurring-expense-form"
import { Field, FieldError, SelectField } from "./recurring-field"
import {
  amountModeOptions,
  currencyOptions,
  durationOptions,
  groupOptions,
} from "./recurring-options"

type RecurringExpenseFormProps = {
  defaultValues: RecurringFormValues
  /** The viewed month: a new recurring expense starts there and only there. */
  period: Period
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (values: RecurringFormValues) => void
  /** RF-09: saves and keeps the form open, reset to its defaults. */
  onSubmitAndAddAnother: (values: RecurringFormValues) => void
  onCancel: () => void
}

export const RecurringExpenseForm = ({
  defaultValues,
  period,
  isSaving,
  errorMessage,
  onSubmit,
  onSubmitAndAddAnother,
  onCancel,
}: RecurringExpenseFormProps) => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecurringFormValues>({
    resolver: recurringResolver,
    defaultValues,
  })

  const amountMode = useWatch({ control, name: "amountMode" })
  const duration = useWatch({ control, name: "duration" })

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      aria-label="Nuevo recurrente"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="recurring-concept" label="Concepto">
          <Input
            id="recurring-concept"
            autoComplete="off"
            aria-invalid={errors.concept !== undefined}
            {...register("concept")}
          />
          <FieldError message={errors.concept?.message} />
        </Field>

        <Field htmlFor="recurring-group" label="Agrupación">
          <Controller
            control={control}
            name="groupLabel"
            render={({ field }) => (
              <SelectField
                id="recurring-group"
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

        <Field htmlFor="recurring-currency" label="Moneda">
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <SelectField
                id="recurring-currency"
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

        <Field htmlFor="recurring-amount-mode" label="Tipo de importe">
          <Controller
            control={control}
            name="amountMode"
            render={({ field }) => (
              <SelectField
                id="recurring-amount-mode"
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

        <Field htmlFor="recurring-starting-amount" label="Importe de este mes">
          <Controller
            control={control}
            name="startingAmount"
            render={({ field }) => (
              <AmountInput
                id="recurring-starting-amount"
                autoComplete="off"
                className="font-mono"
                aria-invalid={errors.startingAmount !== undefined}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={(formattedValue) =>
                  field.onChange(formattedValue)
                }
              />
            )}
          />
          <FieldError message={errors.startingAmount?.message} />
        </Field>

        <Field htmlFor="recurring-duration" label="Repetición">
          <Controller
            control={control}
            name="duration"
            render={({ field }) => (
              <SelectField
                id="recurring-duration"
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
          <Field htmlFor="recurring-total-months" label="Cantidad de meses">
            <Input
              id="recurring-total-months"
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

      <p className="text-xs text-muted-foreground">
        {amountMode === "fixed"
          ? `Se carga en ${formatPeriodLabel(period)} con este importe, que se repite en los meses que generes después.`
          : `Se carga en ${formatPeriodLabel(period)} con este importe. Cada mes siguiente se completa a mano cuando lo generes.`}
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar recurrente"}
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
