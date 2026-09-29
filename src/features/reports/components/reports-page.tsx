import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/use-auth"
import { formatPeriodLabel, getCurrentPeriod } from "@/shared/lib/period"

import {
  useReportExpenseLinesQuery,
  useReportMonthlyBudgetsQuery,
} from "../api/report-queries"
import {
  buildReportDocumentData,
  type ReportExportSource,
} from "../model/report-document"
import {
  applyReportFilters,
  collectGroupLabels,
  EMPTY_REPORT_FILTERS,
  hasActiveFilters,
  type ReportFilters,
} from "../model/report-filters"
import type { ReportExpenseLine } from "../model/report-line"
import {
  clearSelection,
  EMPTY_REPORT_SELECTION,
  selectAllVisible,
  selectedLines,
  selectedLinesOutsideFilter,
  toggleLineSelection,
} from "../model/report-selection"
import {
  computeReportTotals,
  type ExchangeRateByPeriod,
  exchangeRateKey,
} from "../model/report-totals"
import { ReportFiltersPanel } from "./report-filters-panel"
import { ReportLinesTable } from "./report-lines-table"
import { ReportSelectionPanel } from "./report-selection-panel"

const LOAD_ERROR_MESSAGE =
  "No pudimos cargar los gastos del mes. Intentá de nuevo en un momento."

const EMPTY_PERIOD_MESSAGE = "No hay gastos registrados este mes."

const EMPTY_FILTER_MESSAGE =
  "Ningún gasto del mes coincide con los filtros aplicados."

const EXPORT_ERROR_MESSAGE =
  "No pudimos generar el PDF. Intentá de nuevo en un momento."

export const ReportsPage = () => {
  // RF-10: el reporte es siempre el mes calendario actual, sin selector.
  const period = getCurrentPeriod()

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS)
  const [selection, setSelection] = useState(EMPTY_REPORT_SELECTION)
  const [isShowingFullSelection, setIsShowingFullSelection] = useState(false)
  const [includesSalaryContext, setIncludesSalaryContext] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const linesQuery = useReportExpenseLinesQuery(userId, period)
  const budgetsQuery = useReportMonthlyBudgetsQuery(userId, period)

  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="text-lg font-semibold tracking-tight">Reportes</h1>
      <p className="text-xs text-muted-foreground">
        Consultá los gastos cargados este mes y descargalos en PDF.
      </p>
    </div>
  )

  if (linesQuery.isError || budgetsQuery.isError) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Alert variant="destructive">
          <AlertDescription>{LOAD_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (userId === null || linesQuery.isLoading || budgetsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <CardContent className="flex flex-col gap-3">
            {/* The skeleton stands for the result table, so keep a text
                equivalent for assistive technology and for tests. */}
            <p role="status" className="sr-only">
              Cargando los gastos del mes…
            </p>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-7 w-64" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const lines = linesQuery.data ?? []
  const rates: ExchangeRateByPeriod = new Map(
    (budgetsQuery.data ?? []).map((budget) => [
      exchangeRateKey(budget.period),
      budget.exchangeRateValue,
    ])
  )

  const filteredLines = applyReportFilters(lines, filters)
  const hiddenSelectedLines = selectedLinesOutsideFilter(
    selection,
    filteredLines,
    lines
  )
  const visibleLines = isShowingFullSelection
    ? [...filteredLines, ...hiddenSelectedLines]
    : filteredLines

  const totals = computeReportTotals(selectedLines(selection, lines), rates)
  const periodLabel = formatPeriodLabel(period)

  const exportPdf = (
    source: ReportExportSource,
    includedLines: readonly ReportExpenseLine[]
  ) => {
    setIsExporting(true)
    setExportError(null)

    // The PDF renderer is heavy and only matters when the user exports, so it
    // is loaded on demand instead of travelling in the app bundle.
    import("./report-pdf-download")
      .then(({ downloadReportPdf }) =>
        downloadReportPdf(
          buildReportDocumentData({
            period,
            periodLines: lines,
            includedLines,
            budgets: budgetsQuery.data ?? [],
            source,
            includesSalaryContext,
            generatedAt: new Date(),
          })
        )
      )
      .catch(() => setExportError(EXPORT_ERROR_MESSAGE))
      .finally(() => setIsExporting(false))
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <ReportFiltersPanel
        filters={filters}
        groupOptions={collectGroupLabels(lines)}
        onFiltersChange={setFilters}
      />

      {lines.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-base text-foreground">{EMPTY_PERIOD_MESSAGE}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {visibleLines.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-base text-foreground">
                  {EMPTY_FILTER_MESSAGE}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ReportLinesTable
              caption={`Gastos de ${periodLabel}`}
              lines={visibleLines}
              rates={rates}
              selection={selection}
              onToggleLine={(lineId) =>
                setSelection((current) => toggleLineSelection(current, lineId))
              }
            />
          )}

          <ReportSelectionPanel
            selectedCount={selection.size}
            totals={totals}
            hiddenSelectedCount={hiddenSelectedLines.length}
            isShowingFullSelection={isShowingFullSelection}
            includesSalaryContext={includesSalaryContext}
            isExporting={isExporting}
            exportError={exportError}
            onSelectAllVisible={() =>
              setSelection((current) =>
                selectAllVisible(current, filteredLines)
              )
            }
            onClearSelection={() => {
              setSelection(clearSelection())
              setIsShowingFullSelection(false)
            }}
            onToggleFullSelection={() =>
              setIsShowingFullSelection((isShowing) => !isShowing)
            }
            onIncludesSalaryContextChange={setIncludesSalaryContext}
            onExportFiltered={() => exportPdf("filtered", filteredLines)}
            onExportSelection={() =>
              exportPdf("selection", selectedLines(selection, lines))
            }
          />
        </>
      )}

      {hasActiveFilters(filters) ? (
        <p className="text-xs text-muted-foreground">
          Los filtros solo recortan en pantalla lo que ya se consultó para{" "}
          {periodLabel}.
        </p>
      ) : null}
    </div>
  )
}
