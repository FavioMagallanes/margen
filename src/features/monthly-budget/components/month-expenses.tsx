import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatArs } from "@/shared/lib/money"
import type { Period } from "@/shared/lib/period"

import {
  computeExpenseGroupTotals,
  type ExpenseLine,
  toArsEquivalent,
} from "../model/expense-total"
import type { MonthExpenseLine } from "../model/month-expense-line"
import { MonthExpenseActions } from "./month-expense-actions"

type MonthExpensesProps = {
  lines: readonly MonthExpenseLine[]
  arsPerUsd: number | null
  /** The month the lines belong to: every action applies from there (P-04). */
  period: Period
  periodLabel: string
}

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const MISSING_AMOUNT_LABEL = "Sin dato"

/**
 * The line already carries its installment as «n/m», so the last one is read
 * from that text instead of asking the owning feature for its numbers again.
 */
const isLastInstallment = (installment: string | null): boolean => {
  if (installment === null) {
    return false
  }

  const [current, total] = installment.split("/")

  return total !== undefined && current === total
}

const formatOriginalAmount = (line: ExpenseLine) => {
  if (line.amount === null) {
    return MISSING_AMOUNT_LABEL
  }

  if (line.currency === "usd") {
    return usdFormatter.format(line.amount)
  }

  if (line.currency === "ars") {
    return formatArs(line.amount)
  }

  return MISSING_AMOUNT_LABEL
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

      <Card className="py-0">
        <Table className="min-w-[640px] text-sm">
          <TableCaption className="sr-only">
            A pagar en {periodLabel}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="px-4 text-muted-foreground">
                Concepto
              </TableHead>
              <TableHead scope="col" className="px-4 text-muted-foreground">
                Grupo
              </TableHead>
              <TableHead scope="col" className="px-4 text-muted-foreground">
                Cuota
              </TableHead>
              <TableHead
                scope="col"
                className="px-4 text-right text-muted-foreground"
              >
                Importe original
              </TableHead>
              <TableHead
                scope="col"
                className="px-4 text-right text-muted-foreground"
              >
                Equivalente en ARS
              </TableHead>
              <TableHead
                scope="col"
                className="px-4 text-right text-muted-foreground"
              >
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const arsEquivalent = toArsEquivalent(line, arsPerUsd)

              return (
                <TableRow key={line.id}>
                  <TableCell className="px-4">{line.concept}</TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {line.group}
                  </TableCell>
                  <TableCell className="px-4">
                    {line.installment === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Badge variant="outline" className="font-mono">
                          {line.installment}
                        </Badge>
                        {isLastInstallment(line.installment) ? (
                          <Badge variant="secondary">Última cuota</Badge>
                        ) : null}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono">
                    {formatOriginalAmount(line)}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono">
                    {/* An ARS line is already ARS: showing its own amount
                        again as an "equivalent" is meaningless, so only USD
                        lines get a converted value here. */}
                    {line.currency !== "usd" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : arsEquivalent === null ? (
                      MISSING_AMOUNT_LABEL
                    ) : (
                      formatArs(arsEquivalent)
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <MonthExpenseActions line={line} period={period} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
