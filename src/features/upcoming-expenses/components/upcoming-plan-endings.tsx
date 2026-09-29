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
import { formatPeriodLabel } from "@/shared/lib/period"

import type { PlanEnding } from "../model/plan-ending"

type UpcomingPlanEndingsProps = {
  endings: readonly PlanEnding[]
}

const EMPTY_MESSAGE =
  "No hay planes de cuotas en curso que terminen desde este mes en adelante."

export const UpcomingPlanEndings = ({ endings }: UpcomingPlanEndingsProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-sm font-semibold tracking-tight text-foreground">
      Planes que terminan
    </h2>

    {endings.length === 0 ? (
      <Card>
        <CardContent>
          <p className="text-base text-foreground">{EMPTY_MESSAGE}</p>
        </CardContent>
      </Card>
    ) : (
      <Card className="py-0">
        <Table className="min-w-[480px] text-sm">
          <TableCaption className="sr-only">
            Planes de cuotas y su mes de fin
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="px-4 text-muted-foreground">
                Concepto
              </TableHead>
              <TableHead scope="col" className="px-4 text-muted-foreground">
                Agrupación
              </TableHead>
              <TableHead scope="col" className="px-4 text-muted-foreground">
                Termina en
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endings.map((ending) => (
              <TableRow key={ending.planId}>
                <TableCell className="px-4">{ending.concept}</TableCell>
                <TableCell className="px-4 text-muted-foreground">
                  {ending.groupLabel}
                </TableCell>
                <TableCell className="px-4">
                  {formatPeriodLabel(ending.endsAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    )}
  </section>
)
