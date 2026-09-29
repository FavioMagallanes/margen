import { useState } from "react"
import { useParams } from "react-router"

import { Decimal } from "decimal.js"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/use-auth"
import { formatArs } from "@/shared/lib/money"
import {
  addMonths,
  formatPeriodLabel,
  getWorkingPeriod,
  parsePeriod,
} from "@/shared/lib/period"

import { useSaveSalaryMutation } from "./api/monthly-budget-mutations"
import {
  useMonthExpenseLinesQuery,
  useMonthlyBudgetQuery,
} from "./api/monthly-budget-queries"
import { AddExpenseMenu } from "./components/add-expense-menu"
import { ExchangeRatePanel } from "./components/exchange-rate-panel"
import { MonthExpenses } from "./components/month-expenses"
import { SalaryForm } from "./components/salary-form"
import { computeExpenseTotal } from "./model/expense-total"
import { formatSalaryInput } from "./model/salary-form"

const LOAD_ERROR_MESSAGE =
  "No pudimos cargar el presupuesto del mes. Intentá de nuevo en un momento."

const INCOMPLETE_TOTAL_MESSAGE =
  "El cálculo está incompleto: falta algún importe o la cotización del mes, así que este disponible no es definitivo."

export const MonthlyBudgetPage = () => {
  const { year, month } = useParams()
  const period = parsePeriod(year, month) ?? getWorkingPeriod()
  const previousPeriod = addMonths(period, -1)

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const budgetQuery = useMonthlyBudgetQuery(userId, period)
  const expenseLinesQuery = useMonthExpenseLinesQuery(userId, period)
  const previousBudgetQuery = useMonthlyBudgetQuery(userId, previousPeriod)
  const saveSalary = useSaveSalaryMutation(userId)

  const periodKey = `${period.year}-${period.month}`
  const [lastPeriodKey, setLastPeriodKey] = useState(periodKey)
  const [isEditingSalary, setIsEditingSalary] = useState(false)

  // Switching months should never leave a stale edit form open for a
  // different period's salary (React's "adjust state during render" pattern,
  // not an effect, since this only reacts to a prop this component already
  // renders with).
  if (periodKey !== lastPeriodKey) {
    setLastPeriodKey(periodKey)
    setIsEditingSalary(false)
  }

  if (budgetQuery.isError || expenseLinesQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{LOAD_ERROR_MESSAGE}</AlertDescription>
      </Alert>
    )
  }

  if (userId === null || budgetQuery.isLoading || expenseLinesQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          {/* The skeleton mirrors the salary block, so keep a text equivalent
              for assistive technology and for tests. */}
          <p role="status" className="sr-only">
            Cargando el presupuesto…
          </p>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-10 w-56" />
        </CardContent>
      </Card>
    )
  }

  const salaryArs = budgetQuery.data?.salaryArs ?? null
  const arsPerUsd = budgetQuery.data?.exchangeRateValue ?? null
  const expenseLines = expenseLinesQuery.data ?? []
  const { totalKnownArs, isComplete } = computeExpenseTotal(
    expenseLines,
    arsPerUsd
  )

  const previousSalaryArs = previousBudgetQuery.data?.salaryArs ?? null
  const canCopyPreviousSalary = salaryArs === null && previousSalaryArs !== null
  // No salary yet: the form is the only sensible thing to show. Once it's
  // saved, showing the value and the input at the same time is redundant, so
  // the form only reappears if the user asks to edit it.
  const showSalaryForm = salaryArs === null || isEditingSalary

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Sueldo de {formatPeriodLabel(period)}
            </p>

            {showSalaryForm ? (
              <SalaryForm
                key={salaryArs === null ? "sin-sueldo" : String(salaryArs)}
                defaultSalary={
                  salaryArs === null ? "" : formatSalaryInput(salaryArs)
                }
                isSaving={saveSalary.isLoading}
                hasFailed={saveSalary.isError}
                onSave={(nextSalaryArs) =>
                  saveSalary.mutate(
                    { period, salaryArs: nextSalaryArs },
                    { onSuccess: () => setIsEditingSalary(false) }
                  )
                }
                onCancel={
                  salaryArs === null
                    ? undefined
                    : () => setIsEditingSalary(false)
                }
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingSalary(true)}
                className="w-fit rounded-sm font-mono text-xl font-semibold tracking-tight text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {formatArs(salaryArs as number)}
              </button>
            )}

            {canCopyPreviousSalary ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saveSalary.isLoading}
                  onClick={() =>
                    saveSalary.mutate({ period, salaryArs: previousSalaryArs })
                  }
                >
                  Copiar sueldo del mes anterior
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              Gastos conocidos del mes
            </p>
            <p className="font-mono text-xl font-semibold tracking-tight text-foreground">
              {formatArs(totalKnownArs)}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              Disponible del presupuesto
            </p>

            {salaryArs === null ? (
              // RF-01: without a salary there is no definitive available figure.
              <p className="text-base text-foreground">
                Cargá el sueldo del mes para ver el disponible.
              </p>
            ) : (
              <p className="font-mono text-4xl font-semibold tracking-tight text-primary">
                {formatArs(new Decimal(salaryArs).minus(totalKnownArs))}
              </p>
            )}

            {isComplete ? null : (
              <Alert className="mt-1">
                <AlertDescription>{INCOMPLETE_TOTAL_MESSAGE}</AlertDescription>
              </Alert>
            )}
          </div>

          <ExchangeRatePanel
            userId={userId}
            period={period}
            currentRate={arsPerUsd}
            source={budgetQuery.data?.exchangeRateSource ?? null}
            fetchedAt={budgetQuery.data?.exchangeRateFetchedAt ?? null}
            sourceUpdatedAt={
              budgetQuery.data?.exchangeRateSourceUpdatedAt ?? null
            }
            salaryArs={salaryArs}
            expenseLines={expenseLines}
          />
        </CardContent>
      </Card>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">
            A pagar en {formatPeriodLabel(addMonths(period, 1))}
          </h1>
          <p className="text-xs text-muted-foreground">
            Desde acá cargás, editás y eliminás cualquier gasto del mes.
          </p>
        </div>

        <AddExpenseMenu period={period} />
      </div>

      <MonthExpenses
        lines={expenseLines}
        arsPerUsd={arsPerUsd}
        period={period}
        periodLabel={formatPeriodLabel(addMonths(period, 1))}
      />
    </div>
  )
}
