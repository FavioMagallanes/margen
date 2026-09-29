import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { formatPeriodLabel } from "@/shared/lib/period"

import {
  linePeriod,
  REPORT_KIND_LABELS,
  type ReportExpenseLine,
} from "../model/report-line"
import type { ReportSelection } from "../model/report-selection"
import {
  type ExchangeRateByPeriod,
  exchangeRateForLine,
} from "../model/report-totals"
import { formatOriginalAmount, MISSING_AMOUNT_LABEL } from "./report-amounts"

type ReportLinesTableProps = {
  caption: string
  lines: readonly ReportExpenseLine[]
  rates: ExchangeRateByPeriod
  selection: ReportSelection
  onToggleLine: (lineId: string) => void
}

export const ReportLinesTable = ({
  caption,
  lines,
  rates,
  selection,
  onToggleLine,
}: ReportLinesTableProps) => (
  <Card className="py-0">
    <Table className="min-w-[680px] text-sm">
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="px-4 text-muted-foreground">
            Exportar
          </TableHead>
          <TableHead scope="col" className="px-4 text-muted-foreground">
            Concepto
          </TableHead>
          <TableHead scope="col" className="px-4 text-muted-foreground">
            Tarjeta o entidad
          </TableHead>
          <TableHead scope="col" className="px-4 text-muted-foreground">
            Tipo
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
          // RF-11: the equivalent of a line uses the rate saved for its own
          // month, never a single rate for the whole report.
          const arsEquivalent = toArsEquivalent(
            line,
            exchangeRateForLine(line, rates)
          )

          return (
            <TableRow key={line.id}>
              <TableCell className="px-4">
                <Checkbox
                  aria-label={`Seleccionar ${line.concept} de ${formatPeriodLabel(linePeriod(line))}`}
                  checked={selection.has(line.id)}
                  onCheckedChange={() => onToggleLine(line.id)}
                />
              </TableCell>
              <TableCell className="px-4">{line.concept}</TableCell>
              <TableCell className="px-4 text-muted-foreground">
                {line.group}
              </TableCell>
              <TableCell className="px-4">
                <Badge variant="secondary">
                  {REPORT_KIND_LABELS[line.kind]}
                </Badge>
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
                {formatOriginalAmount(line)}
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
