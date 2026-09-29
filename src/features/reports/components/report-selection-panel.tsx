import type { Decimal } from "decimal.js"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { formatArs } from "@/shared/lib/money"

import { REPORT_CURRENCY_LABELS } from "../model/report-line"
import type { ReportTotals } from "../model/report-totals"
import { formatUsd } from "./report-amounts"

const EMPTY_SELECTION_MESSAGE =
  "Seleccioná al menos un gasto para exportar la selección."

const formatSubtotalAmount = (
  currency: "ars" | "usd" | null,
  amount: Decimal | null
): string => {
  if (currency === null || amount === null) {
    return "Sin dato"
  }

  return currency === "usd" ? formatUsd(amount) : formatArs(amount)
}

type ReportSelectionPanelProps = {
  selectedCount: number
  totals: ReportTotals
  visibleGroups: readonly string[]
  hiddenSelectedCount: number
  isShowingFullSelection: boolean
  includesSalaryContext: boolean
  isExporting: boolean
  exportError: string | null
  onSelectGroup: (group: string) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
  onToggleFullSelection: () => void
  onIncludesSalaryContextChange: (includesSalaryContext: boolean) => void
  onExportFiltered: () => void
  onExportSelection: () => void
}

export const ReportSelectionPanel = ({
  selectedCount,
  totals,
  visibleGroups,
  hiddenSelectedCount,
  isShowingFullSelection,
  includesSalaryContext,
  isExporting,
  exportError,
  onSelectGroup,
  onSelectAllVisible,
  onClearSelection,
  onToggleFullSelection,
  onIncludesSalaryContextChange,
  onExportFiltered,
  onExportSelection,
}: ReportSelectionPanelProps) => (
  <Card>
    <CardContent className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">Selección para exportar</p>
        <p className="text-base text-foreground">
          {selectedCount === 1
            ? "1 gasto seleccionado"
            : `${selectedCount} gastos seleccionados`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onSelectAllVisible}>
          Seleccionar todos los resultados del filtro actual
        </Button>
        {visibleGroups.map((group) => (
          <Button
            key={group}
            type="button"
            variant="outline"
            onClick={() => onSelectGroup(group)}
          >
            Seleccionar todo {group}
          </Button>
        ))}
        <Button type="button" variant="ghost" onClick={onClearSelection}>
          Limpiar selección
        </Button>
      </div>

      {hiddenSelectedCount === 0 ? null : (
        <Alert>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>
              {hiddenSelectedCount === 1
                ? "1 gasto seleccionado no aparece con el filtro actual."
                : `${hiddenSelectedCount} gastos seleccionados no aparecen con el filtro actual.`}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={onToggleFullSelection}
            >
              {isShowingFullSelection
                ? "Volver a los resultados del filtro"
                : "Ver la selección completa"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {selectedCount === 0 ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Subtotales de la selección
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {totals.subtotals.map((subtotal) => (
              <li
                key={`${subtotal.group}-${subtotal.currency ?? "sin-moneda"}`}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>
                  {subtotal.group} (
                  {subtotal.currency === null
                    ? "moneda desconocida"
                    : REPORT_CURRENCY_LABELS[subtotal.currency]}
                  )
                </span>
                <span className="font-mono">
                  {formatSubtotalAmount(
                    subtotal.currency,
                    subtotal.originalAmount
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap justify-between gap-2 text-base font-semibold">
            <span>Total equivalente en ARS</span>
            <span className="font-mono">{formatArs(totals.totalArs)}</span>
          </p>
          {totals.isComplete ? null : (
            <p className="text-sm text-foreground">
              El subtotal está incompleto: falta algún importe o la cotización
              de algún mes de la selección.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="report-include-salary-context"
          checked={includesSalaryContext}
          onCheckedChange={(checked) =>
            onIncludesSalaryContextChange(checked === true)
          }
        />
        <Label htmlFor="report-include-salary-context">
          Incluir sueldo y disponible
        </Label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isExporting}
            onClick={onExportFiltered}
          >
            Descargar PDF de los resultados filtrados
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isExporting || selectedCount === 0}
            onClick={onExportSelection}
          >
            Descargar PDF de la selección
          </Button>
        </div>
        {isExporting ? (
          <p role="status" className="text-sm text-muted-foreground">
            Generando el PDF…
          </p>
        ) : null}
        {selectedCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            {EMPTY_SELECTION_MESSAGE}
          </p>
        ) : null}
        {exportError === null ? null : (
          <Alert variant="destructive">
            <AlertDescription>{exportError}</AlertDescription>
          </Alert>
        )}
      </div>
    </CardContent>
  </Card>
)
