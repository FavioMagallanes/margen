import type { ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPeriodLabel } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  CARD_OPTIONS,
  type CardPurchaseFormValues,
  cardPurchaseResolver,
  parsePositiveInteger,
} from "../model/card-purchase-form"

type CardPurchaseFormProps = {
  mode: "create" | "edit"
  defaultValues: CardPurchaseFormValues
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (values: CardPurchaseFormValues) => void
  onCancel: () => void
}

type SelectOption = {
  value: string
  label: string
}

const cardOptions: SelectOption[] = CARD_OPTIONS.map((card) => ({
  value: card,
  label: card,
}))

const currencyOptions: SelectOption[] = [
  { value: "ars", label: "Pesos (ARS)" },
  { value: "usd", label: "Dólares (USD)" },
]

const MONTHS_PER_YEAR = 12

const monthNameFormatter = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "UTC",
})

const monthOptions: SelectOption[] = Array.from(
  { length: MONTHS_PER_YEAR },
  (_value, index) => {
    const name = monthNameFormatter.format(Date.UTC(2026, index, 1))

    return {
      value: String(index + 1),
      label: name.charAt(0).toUpperCase() + name.slice(1),
    }
  }
)

/**
 * The Select root drives the value through `onValueChange` instead of a change
 * event, so every form select needs the same Controller bridge.
 */
const SelectField = ({
  id,
  options,
  value,
  isInvalid,
  onValueChange,
  onBlur,
}: {
  id: string
  options: SelectOption[]
  value: string
  isInvalid: boolean
  onValueChange: (value: string) => void
  onBlur: () => void
}) => (
  <Select
    items={options}
    value={value}
    onValueChange={(selectedValue) => {
      if (selectedValue !== null) {
        onValueChange(selectedValue)
      }
    }}
  >
    <SelectTrigger
      id={id}
      className="h-7 w-full text-sm md:text-xs/relaxed"
      aria-invalid={isInvalid}
      onBlur={onBlur}
    >
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

const FieldError = ({ message }: { message: string | undefined }) =>
  message === undefined ? null : (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )

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

export const CardPurchaseForm = ({
  mode,
  defaultValues,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: CardPurchaseFormProps) => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CardPurchaseFormValues>({
    resolver: cardPurchaseResolver,
    defaultValues,
  })

  const isSinglePayment = useWatch({ control, name: "isSinglePayment" })
  const isCreating = mode === "create"

  const submitLabel = isCreating ? "Guardar compra" : "Guardar cambios"

  const editedInstallment = parsePositiveInteger(
    defaultValues.startingInstallment
  )
  const editedPeriodLabel = formatPeriodLabel({
    year: Number(defaultValues.year),
    month: Number(defaultValues.month),
  })

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      aria-label={isCreating ? "Nueva compra con tarjeta" : "Editar compra"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="card-purchase-concept" label="Concepto">
          <Input
            id="card-purchase-concept"
            autoComplete="off"
            aria-invalid={errors.concept !== undefined}
            {...register("concept")}
          />
          <FieldError message={errors.concept?.message} />
        </Field>

        <Field htmlFor="card-purchase-card" label="Tarjeta">
          <Controller
            control={control}
            name="card"
            render={({ field }) => (
              <SelectField
                id="card-purchase-card"
                options={cardOptions}
                value={field.value}
                isInvalid={errors.card !== undefined}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <FieldError message={errors.card?.message} />
        </Field>

        <Field htmlFor="card-purchase-currency" label="Moneda">
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <SelectField
                id="card-purchase-currency"
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

        <Field htmlFor="card-purchase-quota-amount" label="Importe de la cuota">
          <Controller
            control={control}
            name="quotaAmount"
            render={({ field }) => (
              <AmountInput
                id="card-purchase-quota-amount"
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

      {isCreating ? (
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isSinglePayment"
            render={({ field }) => (
              <Checkbox
                id="card-purchase-single-payment"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
                onBlur={field.onBlur}
              />
            )}
          />
          <Label htmlFor="card-purchase-single-payment">
            Un pago (cuota 1 de 1)
          </Label>
        </div>
      ) : null}

      {isCreating && isSinglePayment ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          {isCreating ? (
            <Field
              htmlFor="card-purchase-starting-installment"
              label="Cuota que se carga"
            >
              <Input
                id="card-purchase-starting-installment"
                type="number"
                min={1}
                inputMode="numeric"
                aria-invalid={errors.startingInstallment !== undefined}
                {...register("startingInstallment")}
              />
              <FieldError message={errors.startingInstallment?.message} />
            </Field>
          ) : null}

          <Field
            htmlFor="card-purchase-total-installments"
            label="Total de cuotas"
          >
            <Input
              id="card-purchase-total-installments"
              type="number"
              min={1}
              inputMode="numeric"
              aria-invalid={errors.totalInstallments !== undefined}
              {...register("totalInstallments")}
            />
            <FieldError message={errors.totalInstallments?.message} />

            {/* The edit hides the starting installment, but its cross-field
                error still has to reach the user. */}
            {isCreating ? null : (
              <FieldError message={errors.startingInstallment?.message} />
            )}
          </Field>
        </div>
      )}

      {isCreating ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="card-purchase-month" label="Mes de la cuota">
            <Controller
              control={control}
              name="month"
              render={({ field }) => (
                <SelectField
                  id="card-purchase-month"
                  options={monthOptions}
                  value={field.value}
                  isInvalid={errors.month !== undefined}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            <FieldError message={errors.month?.message} />
          </Field>

          <Field htmlFor="card-purchase-year" label="Año de la cuota">
            <Input
              id="card-purchase-year"
              type="number"
              inputMode="numeric"
              aria-invalid={errors.year !== undefined}
              {...register("year")}
            />
            <FieldError message={errors.year?.message} />
          </Field>
        </div>
      ) : (
        // P-04: an edit always applies from the installment the user opened.
        <p className="text-xs text-muted-foreground">
          Los cambios se aplican desde la cuota {editedInstallment} de{" "}
          {editedPeriodLabel} en adelante. Los meses anteriores no se modifican.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : submitLabel}
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
