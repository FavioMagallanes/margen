import { describe, expect, it } from "vitest"

import type { ReportMonthlyBudget } from "../../api/report-queries"
import {
  buildReportDocumentData,
  reportFileName,
} from "../../model/report-document"
import type { ReportScope } from "../../model/report-scope"
import { createReportLine } from "../fixtures/report-lines"

const january = { year: 2026, month: 1 }
const february = { year: 2026, month: 2 }

const budgets: readonly ReportMonthlyBudget[] = [
  {
    period: january,
    salaryArs: 1_000_000,
    exchangeRateValue: 1_000,
    exchangeRateSource: "manual",
    exchangeRateFetchedAt: null,
  },
  {
    period: february,
    salaryArs: 1_200_000,
    exchangeRateValue: 2_000,
    exchangeRateSource: "api",
    exchangeRateFetchedAt: null,
  },
]

const scope: ReportScope = { kind: "range", start: january, end: february }

const januaryCard = createReportLine({
  id: "ene-1",
  concept: "Notebook",
  group: "BBVA",
  currency: "ars",
  amount: 100_000,
  year: 2026,
  month: 1,
})

const januaryUsd = createReportLine({
  id: "ene-2",
  concept: "Hosting",
  group: "Visa",
  currency: "usd",
  amount: 100,
  year: 2026,
  month: 1,
})

const februaryUsd = createReportLine({
  id: "feb-1",
  concept: "Hosting",
  group: "Visa",
  currency: "usd",
  amount: 100,
  year: 2026,
  month: 2,
})

const scopeLines = [januaryCard, januaryUsd, februaryUsd]

const buildData = (
  includedLines: readonly ReturnType<typeof createReportLine>[],
  overrides: { includesSalaryContext?: boolean } = {}
) =>
  buildReportDocumentData({
    scope,
    scopeLines,
    includedLines,
    budgets,
    source: "selection",
    includesSalaryContext: overrides.includesSalaryContext ?? true,
    generatedAt: new Date("2026-03-01T12:00:00Z"),
  })

describe("buildReportDocumentData", () => {
  it("suma solamente las líneas incluidas, nunca todo el alcance", () => {
    const data = buildData([januaryCard])

    expect(data.isPartial).toBe(true)
    expect(data.lines.map(({ line }) => line.id)).toEqual(["ene-1"])
    // 100.000 ARS de la única línea exportada; el resto del alcance no entra.
    expect(data.totals.totalArs.toString()).toBe("100000")
  })

  it("convierte cada mes con su propia cotización guardada", () => {
    const data = buildData([januaryUsd, februaryUsd])

    expect(
      data.lines.map(({ line, arsEquivalent }) => [
        line.id,
        arsEquivalent?.toString(),
      ])
    ).toEqual([
      ["ene-2", "100000"],
      ["feb-1", "200000"],
    ])
    expect(data.totals.totalArs.toString()).toBe("300000")
    expect(
      data.months.map((month) => [month.period.month, month.exchangeRateValue])
    ).toEqual([
      [1, 1_000],
      [2, 2_000],
    ])
  })

  it("no mezcla el contexto de sueldo de un mes exportado parcialmente", () => {
    // Enero tiene dos gastos en el alcance y solo se exporta uno.
    const data = buildData([januaryCard, februaryUsd])

    expect(data.salaryContext.map((context) => context.period.month)).toEqual([
      2,
    ])
  })

  it("agrega el contexto del mes cuando la exportación lo cubre entero", () => {
    const data = buildData(scopeLines)

    expect(data.isPartial).toBe(false)
    expect(
      data.salaryContext.map((context) => [
        context.period.month,
        context.monthExpensesArs.toString(),
        context.availableArs?.toString(),
        context.isComplete,
      ])
    ).toEqual([
      // Enero: 100.000 ARS + 100 USD a 1.000.
      [1, "200000", "800000", true],
      [2, "200000", "1000000", true],
    ])
  })

  it("omite el contexto del mes cuando el usuario no lo pidió", () => {
    const data = buildData(scopeLines, { includesSalaryContext: false })

    expect(data.salaryContext).toEqual([])
  })

  it("avisa de importes estimados, conversión de referencia y datos faltantes", () => {
    const estimated = createReportLine({
      id: "feb-2",
      concept: "Luz",
      group: "Servicios",
      currency: "ars",
      amount: 30_000,
      year: 2026,
      month: 2,
      amountIsEstimated: true,
    })
    const missingAmount = createReportLine({
      id: "feb-3",
      concept: "Gas",
      group: "Servicios",
      currency: "ars",
      amount: null,
      year: 2026,
      month: 2,
    })

    const data = buildReportDocumentData({
      scope,
      scopeLines: [...scopeLines, estimated, missingAmount],
      includedLines: [februaryUsd, estimated, missingAmount],
      budgets,
      source: "filtered",
      includesSalaryContext: false,
      generatedAt: new Date("2026-03-01T12:00:00Z"),
    })

    expect(data.warnings).toEqual([
      "estimated_amounts",
      "reference_exchange_rate",
      "incomplete_data",
    ])
  })
})

describe("reportFileName", () => {
  it("no deja separadores inválidos en el nombre del archivo", () => {
    expect(reportFileName(scope)).toBe("margen-reporte-range-2026-1-2026-2.pdf")
    expect(reportFileName({ kind: "all" })).toBe("margen-reporte-all.pdf")
  })
})
