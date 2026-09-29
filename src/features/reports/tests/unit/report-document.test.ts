import { describe, expect, it } from "vitest"

import type { ReportMonthlyBudget } from "../../api/report-queries"
import {
  buildReportDocumentData,
  reportFileName,
} from "../../model/report-document"
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

// El documento rotula el mes del reporte; la conversión de cada línea sigue
// usando la cotización guardada del mes al que pertenece.
const period = january

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

const periodLines = [januaryCard, januaryUsd, februaryUsd]

const buildData = (
  includedLines: readonly ReturnType<typeof createReportLine>[],
  overrides: { includesSalaryContext?: boolean } = {}
) =>
  buildReportDocumentData({
    period,
    periodLines,
    includedLines,
    budgets,
    source: "selection",
    includesSalaryContext: overrides.includesSalaryContext ?? true,
    generatedAt: new Date("2026-03-01T12:00:00Z"),
  })

describe("buildReportDocumentData", () => {
  it("suma solamente las líneas incluidas, nunca todo el mes", () => {
    const data = buildData([januaryCard])

    expect(data.isPartial).toBe(true)
    expect(data.lines.map(({ line }) => line.id)).toEqual(["ene-1"])
    // 100.000 ARS de la única línea exportada; el resto del mes no entra.
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
  })

  it("no mezcla el contexto de sueldo de un mes exportado parcialmente", () => {
    // Enero tiene dos gastos cargados y solo se exporta uno.
    const data = buildData([januaryCard, februaryUsd])

    expect(data.salaryContext.map((context) => context.period.month)).toEqual([
      2,
    ])
  })

  it("agrega el contexto del mes cuando la exportación lo cubre entero", () => {
    const data = buildData(periodLines)

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
    const data = buildData(periodLines, { includesSalaryContext: false })

    expect(data.salaryContext).toEqual([])
  })

  it("suma solo las líneas incluidas al calcular el total, con datos faltantes o estimados", () => {
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
      period,
      periodLines: [...periodLines, estimated, missingAmount],
      includedLines: [februaryUsd, estimated, missingAmount],
      budgets,
      source: "filtered",
      includesSalaryContext: false,
      generatedAt: new Date("2026-03-01T12:00:00Z"),
    })

    expect(data.totals.isComplete).toBe(false)
    expect(data.lines.map(({ line }) => line.id)).toEqual([
      "feb-1",
      "feb-2",
      "feb-3",
    ])
  })
})

describe("reportFileName", () => {
  it("nombra el archivo con el mes del reporte", () => {
    expect(reportFileName(period)).toBe("margen-reporte-2026-01.pdf")
    expect(reportFileName({ year: 2026, month: 12 })).toBe(
      "margen-reporte-2026-12.pdf"
    )
  })
})
