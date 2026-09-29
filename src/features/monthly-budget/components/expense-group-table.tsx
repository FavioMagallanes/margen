import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
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

import { type ExpenseLine, toArsEquivalent } from "../model/expense-total"
import type { MonthExpenseLine } from "../model/month-expense-line"
import { MonthExpenseActions } from "./month-expense-actions"
import { Pagination } from "./pagination"

const EXPENSE_GROUP_PAGE_SIZE = 8

type ExpenseGroupTableProps = {
  group: string
  /** Only the lines of this group. */
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

export const ExpenseGroupTable = ({
  group,
  lines,
  arsPerUsd,
  period,
  periodLabel,
}: ExpenseGroupTableProps) => {
  const [requestedPage, setRequestedPage] = useState(1)

  // The stored page can outlive the lines that justified it (another month,
  // a deleted expense), so it is clamped on every render instead of synced.
  const pageCount = Math.max(
    1,
    Math.ceil(lines.length / EXPENSE_GROUP_PAGE_SIZE)
  )
  const page = Math.min(requestedPage, pageCount)
  const pageLines = lines.slice(
    (page - 1) * EXPENSE_GROUP_PAGE_SIZE,
    page * EXPENSE_GROUP_PAGE_SIZE
  )

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-foreground">{group}</h2>
      <Card className="py-0">
        <Table className="min-w-[640px] text-sm">
          <TableCaption className="sr-only">
            A pagar en {periodLabel} — {group}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="px-4 text-muted-foreground">
                Concepto
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
            {pageLines.map((line) => {
              const arsEquivalent = toArsEquivalent(line, arsPerUsd)

              return (
                <TableRow key={line.id}>
                  <TableCell className="px-4">{line.concept}</TableCell>
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
        {pageCount > 1 ? (
          <Pagination
            page={page}
            pageCount={pageCount}
            label={group}
            onPageChange={setRequestedPage}
          />
        ) : null}
      </Card>
    </section>
  )
}
