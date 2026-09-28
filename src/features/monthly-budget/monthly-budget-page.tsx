import { useParams } from "react-router"

import { Decimal } from "decimal.js"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/use-auth"
import { formatArs } from "@/shared/lib/money"
import {
  addMonths,
  formatPeriodLabel,
  getCurrentPeriod,
  parsePeriod,
} from "@/shared/lib/period"

import { useSaveSalaryMutation } from "./api/monthly-budget-mutations"
import {
  useMonthExpenseLinesQuery,
  useMonthlyBudgetQuery,
} from "./api/monthly-budget-queries"
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
  const period = parsePeriod(year, month) ?? getCurrentPeriod()
  const previousPeriod = addMonths(period, -1)

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const budgetQuery = useMonthlyBudgetQuery(userId, period)
  const expenseLinesQuery = useMonthExpenseLinesQuery(userId, period)
  const previousBudgetQuery = useMonthlyBudgetQuery(userId, previousPeriod)
  const saveSalary = useSaveSalaryMutation(userId)

  if (budgetQuery.isError || expenseLinesQuery.isError) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <p role="alert" className="text-sm text-destructive">
          {LOAD_ERROR_MESSAGE}
        </p>
      </section>
    )
  }

  if (userId === null || budgetQuery.isLoading || expenseLinesQuery.isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Cargando el presupuesto…
        </p>
      </section>
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

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Sueldo de {formatPeriodLabel(period)}
          </p>

          {salaryArs === null ? (
            <p className="text-sm text-muted-foreground">
              Sin presupuesto definido
            </p>
          ) : (
            <p className="font-mono text-sm text-foreground">
              {formatArs(salaryArs)}
            </p>
          )}

          <SalaryForm
            key={salaryArs === null ? "sin-sueldo" : String(salaryArs)}
            defaultSalary={
              salaryArs === null ? "" : formatSalaryInput(salaryArs)
            }
            isSaving={saveSalary.isLoading}
            hasFailed={saveSalary.isError}
            onSave={(nextSalaryArs) =>
              saveSalary.mutate({ period, salaryArs: nextSalaryArs })
            }
          />

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
          <p className="font-mono text-sm text-foreground">
            {formatArs(totalKnownArs)}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Disponible del presupuesto
          </p>

          {salaryArs === null ? (
            // RF-01: without a salary there is no definitive available figure.
            <p className="text-sm text-muted-foreground">
              Cargá el sueldo del mes para ver el disponible.
            </p>
          ) : (
            <p className="font-mono text-4xl font-semibold tracking-tight text-primary">
              {formatArs(new Decimal(salaryArs).minus(totalKnownArs))}
            </p>
          )}

          {isComplete ? null : (
            <p className="text-xs text-muted-foreground">
              {INCOMPLETE_TOTAL_MESSAGE}
            </p>
          )}
        </div>
      </section>

      <MonthExpenses
        lines={expenseLines}
        arsPerUsd={arsPerUsd}
        periodLabel={formatPeriodLabel(period)}
      />
    </div>
  )
}
