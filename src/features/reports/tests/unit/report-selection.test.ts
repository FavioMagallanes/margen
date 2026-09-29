import { describe, expect, it } from "vitest"

import {
  applyReportFilters,
  EMPTY_REPORT_FILTERS,
} from "../../model/report-filters"
import {
  clearSelection,
  EMPTY_REPORT_SELECTION,
  selectAllVisible,
  selectedLines,
  selectedLinesOutsideFilter,
  selectVisibleGroup,
  toggleLineSelection,
} from "../../model/report-selection"
import { createReportLine } from "../fixtures/report-lines"

const lines = [
  createReportLine({ id: "1", concept: "Notebook", group: "BBVA" }),
  createReportLine({ id: "2", concept: "Monitor", group: "BBVA" }),
  createReportLine({ id: "3", concept: "Netflix", group: "Visa" }),
  createReportLine({ id: "4", concept: "Hosting", group: "Otros gastos" }),
]

const sortedIds = (selection: ReadonlySet<string>) => [...selection].sort()

describe("selección de líneas para exportar", () => {
  it("marca y desmarca una línea sin tocar la selección anterior", () => {
    const withOne = toggleLineSelection(EMPTY_REPORT_SELECTION, "1")
    const withTwo = toggleLineSelection(withOne, "3")

    expect(sortedIds(withTwo)).toEqual(["1", "3"])
    expect(sortedIds(toggleLineSelection(withTwo, "1"))).toEqual(["3"])
    expect(sortedIds(withOne)).toEqual(["1"])
  })

  it("selecciona todo un grupo limitado al filtro actual", () => {
    const visible = applyReportFilters(lines, {
      ...EMPTY_REPORT_FILTERS,
      concept: "notebook",
    })

    const selection = selectVisibleGroup(
      EMPTY_REPORT_SELECTION,
      visible,
      "BBVA"
    )

    // "Monitor" también es BBVA, pero el filtro vigente no lo muestra.
    expect(sortedIds(selection)).toEqual(["1"])
  })

  it("selecciona todos los resultados del filtro actual conservando lo ya marcado", () => {
    const visible = applyReportFilters(lines, {
      ...EMPTY_REPORT_FILTERS,
      groups: ["BBVA"],
    })

    const selection = selectAllVisible(new Set(["4"]), visible)

    expect(sortedIds(selection)).toEqual(["1", "2", "4"])
  })

  it("limpia la selección completa", () => {
    expect(sortedIds(clearSelection())).toEqual([])
  })

  it("detecta los seleccionados que el filtro actual dejó fuera", () => {
    const selection = new Set(["1", "3", "4"])
    const visible = applyReportFilters(lines, {
      ...EMPTY_REPORT_FILTERS,
      groups: ["BBVA"],
    })

    expect(
      selectedLinesOutsideFilter(selection, visible, lines).map(
        (line) => line.id
      )
    ).toEqual(["3", "4"])

    // Filtrar nunca descarta nada de la selección.
    expect(selectedLines(selection, lines).map((line) => line.id)).toEqual([
      "1",
      "3",
      "4",
    ])
  })

  it("no avisa de nada cuando todo lo seleccionado sigue visible", () => {
    const selection = new Set(["1"])

    expect(selectedLinesOutsideFilter(selection, lines, lines)).toEqual([])
  })
})
