import { formatArs } from "@/shared/lib/money"

import {
  computeExpenseGroupTotals,
  type ExpenseLine,
  toArsEquivalent,
} from "../model/expense-total"

type MonthExpensesProps = {
  lines: readonly ExpenseLine[]
  arsPerUsd: number | null
  periodLabel: string
}

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const MISSING_AMOUNT_LABEL = "Sin dato"

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
  periodLabel,
}: MonthExpensesProps) => {
  if (lines.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Todavía no cargaste gastos para este mes.
        </p>
      </section>
    )
  }

  const groupTotals = computeExpenseGroupTotals(lines, arsPerUsd)

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {groupTotals.map((groupTotal) => (
          <article
            key={groupTotal.group}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{groupTotal.group}</p>
            <p className="font-mono text-xl font-medium">
              {formatArs(groupTotal.totalKnownArs)}
            </p>
            {groupTotal.isComplete ? null : (
              <p className="text-xs text-muted-foreground">
                Total incompleto: faltan datos de este grupo.
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Gastos de {periodLabel}</caption>
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Concepto
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Grupo
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Cuota
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Importe original
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Equivalente en ARS
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const arsEquivalent = toArsEquivalent(line, arsPerUsd)

                return (
                  <tr
                    key={line.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2">{line.concept}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {line.group}
                    </td>
                    <td className="px-4 py-2">
                      {line.installment === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-xs">
                          {line.installment}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatOriginalAmount(line)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {arsEquivalent === null
                        ? MISSING_AMOUNT_LABEL
                        : formatArs(arsEquivalent)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
