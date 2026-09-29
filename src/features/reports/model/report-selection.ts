import type { ReportExpenseLine } from "./report-line"

/**
 * RF-10: the manual selection is only a set of line ids; it lives as long as
 * the page does and never reaches the database.
 */
export type ReportSelection = ReadonlySet<string>

export const EMPTY_REPORT_SELECTION: ReportSelection = new Set<string>()

export const toggleLineSelection = (
  selection: ReportSelection,
  lineId: string
): ReportSelection => {
  const next = new Set(selection)

  if (!next.delete(lineId)) {
    next.add(lineId)
  }

  return next
}

/** «Seleccionar todos los resultados del filtro actual». */
export const selectAllVisible = (
  selection: ReportSelection,
  visibleLines: readonly ReportExpenseLine[]
): ReportSelection =>
  new Set([...selection, ...visibleLines.map((line) => line.id)])

export const clearSelection = (): ReportSelection => new Set<string>()

export const selectedLines = (
  selection: ReportSelection,
  lines: readonly ReportExpenseLine[]
): ReportExpenseLine[] => lines.filter((line) => selection.has(line.id))

/**
 * Lines selected before a filter hid them. Filtering never discards a
 * selection, so the page has to be able to show what is no longer visible.
 */
export const selectedLinesOutsideFilter = (
  selection: ReportSelection,
  visibleLines: readonly ReportExpenseLine[],
  allLines: readonly ReportExpenseLine[]
): ReportExpenseLine[] => {
  const visibleIds = new Set(visibleLines.map((line) => line.id))

  return allLines.filter(
    (line) => selection.has(line.id) && !visibleIds.has(line.id)
  )
}
