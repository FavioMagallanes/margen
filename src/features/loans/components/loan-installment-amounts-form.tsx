import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPeriodLabel } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  type LoanInstallmentAmount,
  parseLoanInstallmentAmounts,
  type PendingLoanInstallment,
} from "../model/loan-installment-amounts"

type LoanInstallmentAmountsFormProps = {
  concept: string
  installments: readonly PendingLoanInstallment[]
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (amounts: readonly LoanInstallmentAmount[]) => void
  onCancel: () => void
}

const EMPTY_SUBMISSION_MESSAGE =
  "Completá al menos un importe para poder guardar."

const installmentLabel = (installment: PendingLoanInstallment): string =>
  installment.installmentNumber === null
    ? formatPeriodLabel(installment)
    : `cuota ${installment.installmentNumber} de ${formatPeriodLabel(installment)}`

export const LoanInstallmentAmountsForm = ({
  concept,
  installments,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: LoanInstallmentAmountsFormProps) => {
  // The batch form owns its draft amounts: they are transient until the single
  // save lands, so nothing about them belongs to the query cache.
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)

  const handleSubmit = () => {
    const result = parseLoanInstallmentAmounts(draftAmounts)

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
    onSubmit(result.amounts)
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      aria-label={`Completar próximas cuotas de ${concept}`}
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      {installments.length === 0 ? (
        <p className="text-base text-foreground">
          Este préstamo ya tiene todas sus cuotas con importe.
        </p>
      ) : (
        <Table className="text-sm">
          <TableCaption className="sr-only">
            Cuotas sin importe de {concept}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="text-muted-foreground">
                Mes
              </TableHead>
              <TableHead scope="col" className="text-muted-foreground">
                Cuota
              </TableHead>
              <TableHead scope="col" className="text-muted-foreground">
                Importe
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((installment) => {
              const fieldError = fieldErrors[installment.occurrenceId]

              return (
                <TableRow key={installment.occurrenceId}>
                  <TableCell>{formatPeriodLabel(installment)}</TableCell>
                  <TableCell className="font-mono">
                    {installment.installmentNumber ?? "—"}
                  </TableCell>
                  <TableCell>
                    <AmountInput
                      aria-label={`Importe de la ${installmentLabel(installment)}`}
                      autoComplete="off"
                      className="font-mono"
                      aria-invalid={fieldError !== undefined}
                      value={draftAmounts[installment.occurrenceId] ?? ""}
                      onValueChange={(formattedValue) =>
                        setDraftAmounts((previousAmounts) => ({
                          ...previousAmounts,
                          [installment.occurrenceId]: formattedValue,
                        }))
                      }
                    />
                    {fieldError === undefined ? null : (
                      <p role="alert" className="text-xs text-destructive">
                        {fieldError}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving || installments.length === 0}>
          {isSaving ? "Guardando…" : "Guardar importes"}
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
