import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { parseAmountInputValue } from "@/shared/lib/amount-input"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import { isRecurringAmount } from "../model/recurring-expense-form"
import { Field, FieldError } from "./recurring-field"

type RecurringAmountFormProps = {
  concept: string
  period: Period
  defaultAmount: string
  defaultIsEstimated: boolean
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (amount: number, isEstimated: boolean) => void
  onCancel: () => void
}

const AMOUNT_MESSAGE = "Ingresá un importe mayor a cero"

export const RecurringAmountForm = ({
  concept,
  period,
  defaultAmount,
  defaultIsEstimated,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: RecurringAmountFormProps) => {
  // A single transient amount: it belongs to this form, not to the cache.
  const [amount, setAmount] = useState(defaultAmount)
  const [isEstimated, setIsEstimated] = useState(defaultIsEstimated)
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)

  const handleSubmit = () => {
    const parsedAmount = parseAmountInputValue(amount)

    if (!isRecurringAmount(amount) || parsedAmount === null) {
      setFieldError(AMOUNT_MESSAGE)
      return
    }

    setFieldError(undefined)
    onSubmit(parsedAmount.toNumber(), isEstimated)
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      aria-label={`Corregir el importe de ${concept}`}
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <Field
        htmlFor="recurring-occurrence-amount"
        label={`Importe de ${formatPeriodLabel(period)}`}
      >
        <AmountInput
          id="recurring-occurrence-amount"
          autoComplete="off"
          className="font-mono"
          aria-invalid={fieldError !== undefined}
          value={amount}
          onValueChange={(formattedValue) => setAmount(formattedValue)}
        />
        <FieldError message={fieldError} />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox
          id="recurring-occurrence-estimated"
          checked={isEstimated}
          onCheckedChange={(checked) => setIsEstimated(checked === true)}
        />
        <Label htmlFor="recurring-occurrence-estimated">
          Es un importe estimado
        </Label>
      </div>

      {/* Only this month changes: the plan keeps its own fixed amount. */}
      <p className="text-xs text-muted-foreground">
        El cambio afecta solo a {formatPeriodLabel(period)}.
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar importe"}
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
