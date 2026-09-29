import { Card, CardContent } from "@/components/ui/card"
import { formatArs } from "@/shared/lib/money"
import type { Period } from "@/shared/lib/period"

import { computeExpenseGroupTotals } from "../model/expense-total"
import type { MonthExpenseLine } from "../model/month-expense-line"
import { ExpenseGroupTable } from "./expense-group-table"

type MonthExpensesProps = {
  lines: readonly MonthExpenseLine[]
  arsPerUsd: number | null
  /** The month the lines belong to: every action applies from there (P-04). */
  period: Period
  periodLabel: string
}

export const MonthExpenses = ({
  lines,
  arsPerUsd,
  period,
  periodLabel,
}: MonthExpensesProps) => {
  if (lines.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-base text-foreground">
            Todavía no cargaste gastos para este mes.
          </p>
        </CardContent>
      </Card>
    )
  }

  const groupTotals = computeExpenseGroupTotals(lines, arsPerUsd)

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {groupTotals.map((groupTotal) => (
          <Card key={groupTotal.group} size="sm">
            <CardContent className="flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground">
                {groupTotal.group}
              </p>
              <p className="font-mono text-xl font-semibold tracking-tight text-foreground">
                {formatArs(groupTotal.totalKnownArs)}
              </p>
              {groupTotal.isComplete ? null : (
                // Repeated once per group card, so it stays plain text instead
                // of a full alert box, one size step above the group label so
                // it does not read as part of it.
                <p className="text-sm text-foreground">
                  Total incompleto: faltan datos de este grupo.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {groupTotals.map((groupTotal) => (
        <ExpenseGroupTable
          key={groupTotal.group}
          group={groupTotal.group}
          lines={lines.filter((line) => line.group === groupTotal.group)}
          arsPerUsd={arsPerUsd}
          period={period}
          periodLabel={periodLabel}
        />
      ))}
    </>
  )
}
