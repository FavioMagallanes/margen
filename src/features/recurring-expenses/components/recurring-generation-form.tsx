import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  buildRecurringGenerationDrafts,
  parseRecurringGenerationDrafts,
  type RecurringGenerationDraft,
  type RecurringOccurrenceItem,
} from "../model/recurring-generation"
import type { PendingRecurringPlan } from "../model/recurring-plans"

type RecurringGenerationFormProps = {
  plans: readonly PendingRecurringPlan[]
  period: Period
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (items: readonly RecurringOccurrenceItem[]) => void
  onCancel: () => void
}

const EMPTY_SUBMISSION_MESSAGE =
  "Elegí al menos un recurrente para generar este mes."

const EMPTY_DRAFT: RecurringGenerationDraft = {
  action: "fill",
  amount: "",
  isEstimated: false,
}

export const RecurringGenerationForm = ({
  plans,
  period,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: RecurringGenerationFormProps) => {
  // The batch form owns its draft decisions: they are transient until the
  // single save lands, so nothing about them belongs to the query cache.
  const [drafts, setDrafts] = useState<
    Record<string, RecurringGenerationDraft>
  >(() => buildRecurringGenerationDrafts(plans))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)

  const updateDraft = (
    planId: string,
    change: Partial<RecurringGenerationDraft>
  ) =>
    setDrafts((previousDrafts) => ({
      ...previousDrafts,
      [planId]: { ...(previousDrafts[planId] ?? EMPTY_DRAFT), ...change },
    }))

  const handleSubmit = () => {
    const result = parseRecurringGenerationDrafts(plans, drafts)

    if (result.status === "invalid") {
      setFieldErrors(result.errors)
      setEmptyMessage(null)
      return
    }

    if (result.status === "empty") {
      setFieldErrors({})
      setEmptyMessage(EMPTY_SUBMISSION_MESSAGE)
      return
    }

    setFieldErrors({})
    setEmptyMessage(null)
    onSubmit(result.items)
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      aria-label={`Generar recurrentes de ${formatPeriodLabel(period)}`}
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <Table className="min-w-[640px] text-sm">
        <TableCaption className="sr-only">
          Recurrentes pendientes de {formatPeriodLabel(period)}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="text-muted-foreground">
              Concepto
            </TableHead>
            <TableHead scope="col" className="text-muted-foreground">
              Este mes
            </TableHead>
            <TableHead scope="col" className="text-muted-foreground">
              Importe
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => {
            const draft = drafts[plan.planId] ?? EMPTY_DRAFT
            const fieldError = fieldErrors[plan.planId]

            return (
              <TableRow key={plan.planId}>
                <TableCell>
                  <span className="flex flex-col gap-0.5">
                    <span>{plan.concept}</span>
                    <span className="text-xs text-muted-foreground">
                      {plan.groupLabel}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    id={`recurring-action-${plan.planId}-label`}
                    className="sr-only"
                  >
                    Qué hacer con {plan.concept} este mes
                  </span>
                  <RadioGroup
                    aria-labelledby={`recurring-action-${plan.planId}-label`}
                    value={draft.action}
                    onValueChange={(selectedValue) => {
                      if (
                        selectedValue === "fill" ||
                        selectedValue === "skip"
                      ) {
                        updateDraft(plan.planId, { action: selectedValue })
                      }
                    }}
                    className="flex flex-wrap gap-x-4 gap-y-2"
                  >
                    <span className="flex items-center gap-2">
                      <RadioGroupItem
                        id={`recurring-fill-${plan.planId}`}
                        value="fill"
                      />
                      <Label htmlFor={`recurring-fill-${plan.planId}`}>
                        Cargar importe
                      </Label>
                    </span>
                    <span className="flex items-center gap-2">
                      <RadioGroupItem
                        id={`recurring-skip-${plan.planId}`}
                        value="skip"
                      />
                      <Label htmlFor={`recurring-skip-${plan.planId}`}>
                        Omitir este mes
                      </Label>
                    </span>
                  </RadioGroup>
                </TableCell>
                <TableCell>
                  {draft.action === "skip" ? (
                    <span className="text-muted-foreground">
                      Sin importe este mes
                    </span>
                  ) : (
                    <span className="flex flex-col gap-1">
                      <AmountInput
                        aria-label={`Importe de ${plan.concept}`}
                        autoComplete="off"
                        className="font-mono"
                        aria-invalid={fieldError !== undefined}
                        value={draft.amount}
                        onValueChange={(formattedValue) =>
                          updateDraft(plan.planId, {
                            amount: formattedValue,
                            // Once the user writes the amount it is a real
                            // figure, not the estimate we prefilled.
                            isEstimated: false,
                          })
                        }
                      />
                      {draft.isEstimated ? (
                        <Badge variant="secondary" className="w-fit">
                          Estimado
                        </Badge>
                      ) : null}
                      {fieldError === undefined ? null : (
                        <p role="alert" className="text-xs text-destructive">
                          {fieldError}
                        </p>
                      )}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <p className="text-xs text-muted-foreground">
        Un importe estimado viene del último mes cargado: corregilo antes de
        confirmar. Si dejás un importe vacío, ese recurrente no se genera
        todavía y vas a poder generarlo más adelante.
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Generando…" : "Generar recurrentes"}
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

      {emptyMessage === null ? null : (
        <Alert>
          <AlertDescription>{emptyMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
