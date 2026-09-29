import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/use-auth"
import { getCurrentPeriod, type Period } from "@/shared/lib/period"

import {
  useReportExpenseLinesQuery,
  useReportMonthlyBudgetsQuery,
} from "../api/report-queries"
import {
  applyReportFilters,
  collectGroupLabels,
  EMPTY_REPORT_FILTERS,
  hasActiveFilters,
  type ReportFilters,
} from "../model/report-filters"
import {
  formatScopeLabel,
  isPeriodBefore,
  type ReportScope,
  scopeCacheKey,
} from "../model/report-scope"
import {
  clearSelection,
  EMPTY_REPORT_SELECTION,
  selectAllVisible,
  selectedLines,
  selectedLinesOutsideFilter,
  selectVisibleGroup,
  toggleLineSelection,
} from "../model/report-selection"
import {
  computeReportTotals,
  type ExchangeRateByPeriod,
  exchangeRateKey,
} from "../model/report-totals"
import { ReportFiltersPanel } from "./report-filters-panel"
import { ReportLinesTable } from "./report-lines-table"
import {
  type ReportScopeKind,
  ReportScopeSelector,
} from "./report-scope-selector"
import { ReportSelectionPanel } from "./report-selection-panel"

const LOAD_ERROR_MESSAGE =
  "No pudimos cargar los gastos del alcance elegido. Intentá de nuevo en un momento."

const INVALID_RANGE_MESSAGE =
  "El mes inicial del rango tiene que ser anterior o igual al final."

const EMPTY_SCOPE_MESSAGE = "No hay gastos registrados en el alcance elegido."

const EMPTY_FILTER_MESSAGE =
  "Ningún gasto del alcance coincide con los filtros aplicados."

const isCompletePeriod = ({ year, month }: Period): boolean =>
  Number.isInteger(year) &&
  Number.isInteger(month) &&
  year >= 2000 &&
  month >= 1 &&
  month <= 12

/** Null while the chosen range is still invalid: nothing is consulted then. */
const buildScope = (
  scopeKind: ReportScopeKind,
  currentPeriod: Period,
  rangeStart: Period,
  rangeEnd: Period
): ReportScope | null => {
  if (scopeKind === "month") {
    return { kind: "month", period: currentPeriod }
  }

  if (scopeKind === "all") {
    return { kind: "all" }
  }

  if (!isCompletePeriod(rangeStart) || !isCompletePeriod(rangeEnd)) {
    return null
  }

  return isPeriodBefore(rangeEnd, rangeStart)
    ? null
    : { kind: "range", start: rangeStart, end: rangeEnd }
}

export const ReportsPage = () => {
  const currentPeriod = getCurrentPeriod()

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [scopeKind, setScopeKind] = useState<ReportScopeKind>("month")
  const [rangeStart, setRangeStart] = useState<Period>(currentPeriod)
  const [rangeEnd, setRangeEnd] = useState<Period>(currentPeriod)
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS)
  const [selection, setSelection] = useState(EMPTY_REPORT_SELECTION)
  const [isShowingFullSelection, setIsShowingFullSelection] = useState(false)
  const [includesSalaryContext, setIncludesSalaryContext] = useState(false)

  const scope = buildScope(scopeKind, currentPeriod, rangeStart, rangeEnd)
  const scopeKey = scope === null ? "invalido" : scopeCacheKey(scope)
  const [lastScopeKey, setLastScopeKey] = useState(scopeKey)

  // RF-10: choosing another scope starts a new export, so the manual selection
  // does not survive it (adjusting state during render, not an effect: this
  // only reacts to state this component already renders with). A filter
  // change, on the contrary, keeps the selection intact.
  if (scopeKey !== lastScopeKey) {
    setLastScopeKey(scopeKey)
    setSelection(clearSelection())
    setIsShowingFullSelection(false)
  }

  // A null scope means the range is still invalid, so no query runs: the
  // placeholder scope never reaches the server.
  const queryUserId = scope === null ? null : userId
  const queriedScope: ReportScope = scope ?? {
    kind: "month",
    period: currentPeriod,
  }

  const linesQuery = useReportExpenseLinesQuery(queryUserId, queriedScope)
  const budgetsQuery = useReportMonthlyBudgetsQuery(queryUserId, queriedScope)

  const scopeSelector = (
    <ReportScopeSelector
      scopeKind={scopeKind}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      scopeLabel={scope === null ? null : formatScopeLabel(scope)}
      rangeError={scope === null ? INVALID_RANGE_MESSAGE : null}
      onScopeKindChange={setScopeKind}
      onRangeStartChange={setRangeStart}
      onRangeEndChange={setRangeEnd}
    />
  )

  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="text-lg font-semibold tracking-tight">Reportes</h1>
      <p className="text-xs text-muted-foreground">
        Consultá los gastos de uno o varios meses y elegí qué exportar.
      </p>
    </div>
  )

  if (linesQuery.isError || budgetsQuery.isError) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {scopeSelector}
        <Alert variant="destructive">
          <AlertDescription>{LOAD_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (scope === null) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {scopeSelector}
      </div>
    )
  }

  if (userId === null || linesQuery.isLoading || budgetsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {scopeSelector}
        <Card>
          <CardContent className="flex flex-col gap-3">
            {/* The skeleton stands for the result table, so keep a text
                equivalent for assistive technology and for tests. */}
            <p role="status" className="sr-only">
              Cargando los gastos del alcance…
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
  const scopeLabel = formatScopeLabel(scope)

  return (
    <div className="flex flex-col gap-6">
      {header}
      {scopeSelector}

      <ReportFiltersPanel
        filters={filters}
        groupOptions={collectGroupLabels(lines)}
        onFiltersChange={setFilters}
      />

      {lines.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-base text-foreground">{EMPTY_SCOPE_MESSAGE}</p>
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
              caption={`Gastos de ${scopeLabel}`}
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
            visibleGroups={collectGroupLabels(filteredLines)}
            hiddenSelectedCount={hiddenSelectedLines.length}
            isShowingFullSelection={isShowingFullSelection}
            includesSalaryContext={includesSalaryContext}
            onSelectGroup={(group) =>
              setSelection((current) =>
                selectVisibleGroup(current, filteredLines, group)
              )
            }
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
          />
        </>
      )}

      {hasActiveFilters(filters) ? (
        <p className="text-xs text-muted-foreground">
          Los filtros solo recortan en pantalla lo que ya se consultó para{" "}
          {scopeLabel}.
        </p>
      ) : null}
    </div>
  )
}
