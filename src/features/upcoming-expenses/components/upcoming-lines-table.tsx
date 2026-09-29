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
import { toArsEquivalent } from "@/features/monthly-budget/model/expense-total"
import { formatArs } from "@/shared/lib/money"

import {
  classifyUpcomingLine,
  type UpcomingExpenseLine,
} from "../model/upcoming-line"

type UpcomingLinesTableProps = {
  caption: string
  lines: readonly UpcomingExpenseLine[]
  arsPerUsd: number | null
}

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

export const MISSING_AMOUNT_LABEL = "Sin dato"

/** The amount as it was loaded, in its own currency (RF-06). */
const formatOriginalAmount = (line: UpcomingExpenseLine): string => {
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

export const UpcomingLinesTable = ({
  caption,
  lines,
  arsPerUsd,
}: UpcomingLinesTableProps) => (
  <Card className="py-0">
    <Table className="min-w-[640px] text-sm">
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="px-4 text-muted-foreground">
            Concepto
          </TableHead>
          <TableHead scope="col" className="px-4 text-muted-foreground">
            Agrupación
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
                  <Badge variant="outline" className="font-mono">
                    {line.installment}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="px-4 text-right font-mono">
                <span className="flex items-center justify-end gap-2">
                  {classifyUpcomingLine(line) === "estimated" ? (
                    <Badge variant="secondary" className="font-sans">
                      Estimado
                    </Badge>
                  ) : null}
                  {formatOriginalAmount(line)}
                </span>
              </TableCell>
              <TableCell className="px-4 text-right font-mono">
                {/* An ARS line already is ARS: repeating its own amount as an
                    "equivalent" says nothing, so only USD lines show one. */}
                {line.currency !== "usd" ? (
                  <span className="text-muted-foreground">—</span>
                ) : arsEquivalent === null ? (
                  MISSING_AMOUNT_LABEL
                ) : (
                  formatArs(arsEquivalent)
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  </Card>
)
