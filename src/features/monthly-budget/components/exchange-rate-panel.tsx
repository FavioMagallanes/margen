import { useState } from "react"

import { Decimal } from "decimal.js"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { parseAmountInputValue } from "@/shared/lib/amount-input"
import { formatArs } from "@/shared/lib/money"
import type { Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import {
  FETCH_EXCHANGE_RATE_ERROR_MESSAGE,
  SAVE_EXCHANGE_RATE_ERROR_MESSAGE,
  useFetchTarjetaExchangeRateMutation,
  useSaveExchangeRateMutation,
} from "../api/monthly-budget-mutations"
import type { ExchangeRateSource } from "../api/monthly-budget-queries"
import { computeExpenseTotal, type ExpenseAmount } from "../model/expense-total"

type ExchangeRatePanelProps = {
  userId: string
  period: Period
  currentRate: number | null
  source: ExchangeRateSource | null
  fetchedAt: string | null
  sourceUpdatedAt: string | null
  salaryArs: number | null
  expenseLines: readonly ExpenseAmount[]
}

/** The rate waiting for the user's confirmation; nothing is saved until then. */
type ExchangeRateCandidate = {
  rateArs: number
  source: ExchangeRateSource
  sourceUpdatedAt: string | null
}

const EMPTY_RATE_MESSAGE = "Todavía no se cargó la cotización de este mes."

const MISSING_RATE_LABEL = "Sin cotización"

const INVALID_MANUAL_RATE_MESSAGE = "Ingresá una cotización mayor que cero."

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const formatInstant = (isoInstant: string | null): string | null => {
  if (isoInstant === null) {
    return null
  }

  const instant = new Date(isoInstant)

  return Number.isNaN(instant.getTime()) ? null : dateFormatter.format(instant)
}

const formatRate = (rateArs: number): string => `${formatArs(rateArs)} por USD`

/**
 * RF-07: the instant the app fetched the rate is never shown as the instant the
 * source updated it, so each origin names its own date.
 */
const describeOrigin = (
  source: ExchangeRateSource | null,
  fetchedAt: string | null,
  sourceUpdatedAt: string | null
): string | null => {
  const fetchedDate = formatInstant(fetchedAt)

  if (source === "manual") {
    return fetchedDate === null
      ? "Editada manualmente"
      : `Editada manualmente el ${fetchedDate}`
  }

  if (source !== "api") {
    return null
  }

  const sourceDate = formatInstant(sourceUpdatedAt)

  if (sourceDate !== null) {
    return `Actualizada automáticamente el ${sourceDate}`
  }

  return fetchedDate === null
    ? "Actualizada automáticamente"
    : `Consultada automáticamente el ${fetchedDate}`
}

type PreviewRowProps = {
  label: string
  value: string
}

const PreviewRow = ({ label, value }: PreviewRowProps) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-mono text-sm text-foreground">{value}</dd>
  </div>
)

export const ExchangeRatePanel = ({
  userId,
  period,
  currentRate,
  source,
  fetchedAt,
  sourceUpdatedAt,
  salaryArs,
  expenseLines,
}: ExchangeRatePanelProps) => {
  const fetchRate = useFetchTarjetaExchangeRateMutation()
  const saveRate = useSaveExchangeRateMutation(userId)

  const [candidate, setCandidate] = useState<ExchangeRateCandidate | null>(null)
  const [manualValue, setManualValue] = useState<string | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)

  const closePreview = () => setCandidate(null)

  const startManualEdit = () => {
    fetchRate.reset()
    setManualError(null)
    setManualValue("")
  }

  const cancelManualEdit = () => {
    setManualError(null)
    setManualValue(null)
  }

  const submitManualRate = () => {
    const parsedRate = parseAmountInputValue(manualValue ?? "")

    if (parsedRate === null || parsedRate.lessThanOrEqualTo(0)) {
      setManualError(INVALID_MANUAL_RATE_MESSAGE)

      return
    }

    setManualError(null)
    setCandidate({
      rateArs: parsedRate.toNumber(),
      source: "manual",
      sourceUpdatedAt: null,
    })
  }

  const updateFromProvider = () => {
    setManualValue(null)
    setManualError(null)
    fetchRate.mutate(undefined, {
      onSuccess: ({ ventaArs, sourceUpdatedAt: providerUpdatedAt }) =>
        setCandidate({
          rateArs: ventaArs,
          source: "api",
          sourceUpdatedAt: providerUpdatedAt,
        }),
    })
  }

  const applyCandidate = () => {
    if (candidate === null) {
      return
    }

    saveRate.mutate(
      {
        period,
        rateArs: candidate.rateArs,
        source: candidate.source,
        sourceUpdatedAt: candidate.sourceUpdatedAt,
      },
      {
        onSuccess: () => {
          setManualValue(null)
          closePreview()
        },
      }
    )
  }

  const currentTotal = computeExpenseTotal(expenseLines, currentRate)
  const candidateTotal = computeExpenseTotal(
    expenseLines,
    candidate?.rateArs ?? null
  )

  const originCaption = describeOrigin(source, fetchedAt, sourceUpdatedAt)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Cotización del dólar</p>

      {currentRate === null ? (
        <p className="text-base text-foreground">{EMPTY_RATE_MESSAGE}</p>
      ) : (
        <p className="font-mono text-xl font-semibold tracking-tight text-foreground">
          {formatRate(currentRate)}
        </p>
      )}

      {originCaption === null ? null : (
        <p className="text-xs text-muted-foreground">{originCaption}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={fetchRate.isLoading}
          onClick={updateFromProvider}
        >
          {fetchRate.isLoading ? "Consultando…" : "Actualizar cotización"}
        </Button>

        {manualValue === null ? (
          <Button type="button" variant="ghost" onClick={startManualEdit}>
            Editar manualmente
          </Button>
        ) : null}
      </div>

      {fetchRate.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {FETCH_EXCHANGE_RATE_ERROR_MESSAGE}
          </AlertDescription>
        </Alert>
      ) : null}

      {manualValue === null ? null : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submitManualRate()
          }}
          className="flex flex-col gap-1.5"
        >
          <Label
            htmlFor="manual-exchange-rate"
            className="text-muted-foreground"
          >
            Cotización manual (ARS por USD)
          </Label>

          <div className="flex items-start gap-2">
            <AmountInput
              id="manual-exchange-rate"
              autoComplete="off"
              className="w-48 font-mono"
              aria-invalid={manualError !== null}
              value={manualValue}
              onValueChange={(formattedValue) => setManualValue(formattedValue)}
            />
            <Button type="submit">Ver impacto</Button>
            <Button type="button" variant="ghost" onClick={cancelManualEdit}>
              Cancelar edición manual
            </Button>
          </div>

          {manualError === null ? null : (
            <p role="alert" className="text-xs text-destructive">
              {manualError}
            </p>
          )}
        </form>
      )}

      <AlertDialog
        open={candidate !== null}
        onOpenChange={(open) => {
          if (!open) {
            closePreview()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aplicar esta cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Así quedarían los totales de este mes con la cotización nueva.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <dl className="flex flex-col gap-1">
            <PreviewRow
              label="Cotización anterior"
              value={
                currentRate === null
                  ? MISSING_RATE_LABEL
                  : formatRate(currentRate)
              }
            />
            <PreviewRow
              label="Cotización nueva"
              value={
                candidate === null
                  ? MISSING_RATE_LABEL
                  : formatRate(candidate.rateArs)
              }
            />
            <PreviewRow
              label="Gastos conocidos del mes"
              value={`${formatArs(currentTotal.totalKnownArs)} → ${formatArs(
                candidateTotal.totalKnownArs
              )}`}
            />
            <PreviewRow
              label="Disponible del presupuesto"
              value={
                salaryArs === null
                  ? "Sin sueldo cargado"
                  : `${formatArs(
                      new Decimal(salaryArs).minus(currentTotal.totalKnownArs)
                    )} → ${formatArs(
                      new Decimal(salaryArs).minus(candidateTotal.totalKnownArs)
                    )}`
              }
            />
          </dl>

          {saveRate.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {SAVE_EXCHANGE_RATE_ERROR_MESSAGE}
              </AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={saveRate.isLoading}
              onClick={applyCandidate}
            >
              {saveRate.isLoading ? "Aplicando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
