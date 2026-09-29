import { useParams } from "react-router"

import { Decimal } from "decimal.js"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/use-auth"
import { computeExpenseTotal } from "@/features/monthly-budget/model/expense-total"
import { formatArs } from "@/shared/lib/money"
import {
  formatPeriodLabel,
  getCurrentPeriod,
  parsePeriod,
} from "@/shared/lib/period"

import {
  useUpcomingExpenseLinesQuery,
  useUpcomingPlanEndingsQuery,
} from "../api/upcoming-queries"
import { UpcomingLinesTable } from "./upcoming-lines-table"
import { UpcomingPlanEndings } from "./upcoming-plan-endings"

const LOAD_ERROR_MESSAGE =
  "No pudimos cargar lo comprometido de este mes. Intentá de nuevo en un momento."

const EMPTY_MESSAGE =
  "Este mes no tiene nada comprometido: ni cuotas, ni préstamos, ni recurrentes."

const INCOMPLETE_TOTAL_MESSAGE =
  "El total está incompleto: falta algún importe o la cotización del mes, así que esto no es definitivo."

const PROJECTED_MESSAGE =
  "Las líneas «Proyectado» todavía no existen como gasto: se derivan de los recurrentes activos y recién se cargan cuando las generás desde Recurrentes."

const USD_REFERENCE_MESSAGE =
  "Las líneas en USD se convierten con la cotización guardada del mes como referencia presupuestaria, no como el importe que va a cobrar el banco."

export const UpcomingExpensesPage = () => {
  const { year, month } = useParams()
  const period = parsePeriod(year, month) ?? getCurrentPeriod()
  const periodLabel = formatPeriodLabel(period)

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const monthQuery = useUpcomingExpenseLinesQuery(userId, period)
  const planEndingsQuery = useUpcomingPlanEndingsQuery(userId, period)

  if (monthQuery.isError || planEndingsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{LOAD_ERROR_MESSAGE}</AlertDescription>
      </Alert>
    )
  }

  if (userId === null || monthQuery.isLoading || planEndingsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          {/* The skeleton mirrors the committed total, so keep a text
              equivalent for assistive technology and for tests. */}
          <p role="status" className="sr-only">
            Cargando lo comprometido del mes…
          </p>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const lines = monthQuery.data?.lines ?? []
  const budget = monthQuery.data?.budget ?? null
  const salaryArs = budget?.salaryArs ?? null
  const arsPerUsd = budget?.exchangeRateValue ?? null
  const { totalKnownArs, isComplete } = computeExpenseTotal(lines, arsPerUsd)

  const hasProjectedLines = lines.some((line) => line.origin === "projected")
  const hasUsdLines = lines.some((line) => line.currency === "usd")

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Próximos meses
        </h1>
        <p className="text-sm text-muted-foreground">
          Lo que ya está comprometido en {periodLabel} por tarjetas, préstamos y
          recurrentes.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Comprometido conocido de {periodLabel}
          </p>
          <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            {formatArs(totalKnownArs)}
          </p>
          {isComplete ? null : (
            <Alert className="mt-1">
              <AlertDescription>{INCOMPLETE_TOTAL_MESSAGE}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardContent className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Disponible estimado del mes
          </p>

          {salaryArs === null ? (
            // RF-01: without a salary there is no available figure, and that
            // must not hide everything else this month already commits.
            <p className="text-base text-foreground">
              Cargá el sueldo de {periodLabel} para ver el disponible.
            </p>
          ) : (
            <p className="font-mono text-4xl font-semibold tracking-tight text-primary">
              {formatArs(new Decimal(salaryArs).minus(totalKnownArs))}
            </p>
          )}
        </CardContent>
      </Card>

      {lines.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-base text-foreground">{EMPTY_MESSAGE}</p>
          </CardContent>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          {hasProjectedLines ? (
            <Alert>
              <AlertDescription>{PROJECTED_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}

          {hasUsdLines ? (
            <Alert>
              <AlertDescription>{USD_REFERENCE_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}

          <UpcomingLinesTable
            caption={`Comprometido de ${periodLabel}`}
            lines={lines}
            arsPerUsd={arsPerUsd}
          />
        </section>
      )}

      <UpcomingPlanEndings endings={planEndingsQuery.data ?? []} />
    </div>
  )
}
