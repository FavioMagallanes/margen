import { describe, expect, it } from "vitest"

import {
  applyReportFilters,
  collectGroupLabels,
  EMPTY_REPORT_FILTERS,
  toggleFilterOption,
} from "../../model/report-filters"
import { createReportLine } from "../fixtures/report-lines"

const lines = [
  createReportLine({
    id: "1",
    concept: "Netflix",
    group: "Visa",
    kind: "recurring",
    currency: "usd",
    amount: 12,
  }),
  createReportLine({
    id: "2",
    concept: "  netflix  familiar",
    group: "BBVA",
    kind: "card_purchase",
    currency: "ars",
  }),
  createReportLine({
    id: "3",
    concept: "Préstamo del auto",
    group: "BBVA",
    kind: "loan",
    currency: "ars",
  }),
  createReportLine({
    id: "4",
    concept: "Hosting",
    group: "Otros gastos",
    kind: "other",
    currency: "usd",
    amount: 5,
  }),
  createReportLine({
    id: "5",
    concept: "Sin moneda",
    group: "BBVA",
    kind: "other",
    currency: null,
  }),
]

const idsOf = (filtered: readonly { id: string }[]) =>
  filtered.map((line) => line.id)

describe("applyReportFilters", () => {
  it("sin filtros devuelve todas las líneas del alcance", () => {
    expect(idsOf(applyReportFilters(lines, EMPTY_REPORT_FILTERS))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ])
  })

  it("filtra por concepto sin distinguir mayúsculas ni espacios", () => {
    const filtered = applyReportFilters(lines, {
      ...EMPTY_REPORT_FILTERS,
      concept: "  NETFLIX ",
    })

    expect(idsOf(filtered)).toEqual(["1", "2"])
  })

  it("filtra por tipo de gasto con multi-selección", () => {
    const filtered = applyReportFilters(lines, {
      ...EMPTY_REPORT_FILTERS,
      kinds: ["loan", "other"],
    })

    expect(idsOf(filtered)).toEqual(["3", "4", "5"])
  })

  it("filtra por tarjeta o entidad", () => {
    const filtered = applyReportFilters(lines, {
      ...EMPTY_REPORT_FILTERS,
      groups: ["BBVA"],
    })

    expect(idsOf(filtered)).toEqual(["2", "3", "5"])
  })

  it("filtra por moneda original y deja fuera una moneda desconocida", () => {
    expect(
      idsOf(
        applyReportFilters(lines, {
          ...EMPTY_REPORT_FILTERS,
          currencies: ["usd"],
        })
      )
    ).toEqual(["1", "4"])

    // Una moneda que la app no sabe leer no se adivina como ARS (RF-06).
    expect(
      idsOf(
        applyReportFilters(lines, {
          ...EMPTY_REPORT_FILTERS,
          currencies: ["ars"],
        })
      )
    ).toEqual(["2", "3"])
  })

  it("combina los cuatro filtros", () => {
    const filtered = applyReportFilters(lines, {
      concept: "net",
      kinds: ["card_purchase", "recurring"],
      groups: ["Visa", "BBVA"],
      currencies: ["ars"],
    })

    expect(idsOf(filtered)).toEqual(["2"])
  })

  it("no devuelve resultados cuando los filtros se contradicen", () => {
    const filtered = applyReportFilters(lines, {
      ...EMPTY_REPORT_FILTERS,
      kinds: ["loan"],
      currencies: ["usd"],
    })

    expect(filtered).toEqual([])
  })
})

describe("collectGroupLabels", () => {
  it("arma las opciones con los grupos realmente presentes", () => {
    expect(collectGroupLabels(lines)).toEqual(["BBVA", "Otros gastos", "Visa"])
  })
})

describe("toggleFilterOption", () => {
  it("agrega y saca una opción sin mutar la lista original", () => {
    const groups = ["BBVA"]

    expect(toggleFilterOption(groups, "Visa")).toEqual(["BBVA", "Visa"])
    expect(toggleFilterOption(groups, "BBVA")).toEqual([])
    expect(groups).toEqual(["BBVA"])
  })
})
