import { describe, expect, it } from "vitest"

import {
  computeReportTotals,
  type ExchangeRateByPeriod,
  exchangeRateKey,
} from "../../model/report-totals"
import { createReportLine } from "../fixtures/report-lines"

// Cada mes conserva su propia cotización guardada (RF-11).
const rates: ExchangeRateByPeriod = new Map([
  [exchangeRateKey({ year: 2026, month: 1 }), 1000],
  [exchangeRateKey({ year: 2026, month: 2 }), 2000],
  [exchangeRateKey({ year: 2026, month: 3 }), null],
])

describe("computeReportTotals", () => {
  it("convierte cada línea con la cotización de su propio mes", () => {
    const totals = computeReportTotals(
      [
        createReportLine({
          id: "1",
          group: "Visa",
          currency: "usd",
          amount: 100,
          year: 2026,
          month: 1,
        }),
        createReportLine({
          id: "2",
          group: "Visa",
          currency: "usd",
          amount: 100,
          year: 2026,
          month: 2,
        }),
      ],
      rates
    )

    // 100 * 1000 en enero + 100 * 2000 en febrero, nunca una sola cotización.
    expect(totals.totalArs.toString()).toBe("300000")
    expect(totals.isComplete).toBe(true)
    expect(totals.subtotals).toHaveLength(1)
    expect(totals.subtotals[0]?.originalAmount?.toString()).toBe("200")
  })

  it("separa subtotales por grupo y moneda", () => {
    const totals = computeReportTotals(
      [
        createReportLine({
          id: "1",
          group: "Visa",
          currency: "usd",
          amount: 100,
          year: 2026,
          month: 1,
        }),
        createReportLine({
          id: "2",
          group: "Visa",
          currency: "ars",
          amount: 50_000,
          year: 2026,
          month: 2,
        }),
        createReportLine({
          id: "3",
          group: "BBVA",
          currency: "ars",
          amount: 25_000,
          year: 2026,
          month: 2,
        }),
      ],
      rates
    )

    expect(
      totals.subtotals.map((subtotal) => [
        subtotal.group,
        subtotal.currency,
        subtotal.originalAmount?.toString(),
        subtotal.arsEquivalent.toString(),
      ])
    ).toEqual([
      ["Visa", "usd", "100", "100000"],
      ["Visa", "ars", "50000", "50000"],
      ["BBVA", "ars", "25000", "25000"],
    ])
    expect(totals.totalArs.toString()).toBe("175000")
  })

  it("deja fuera del total el importe faltante y avisa que está incompleto", () => {
    const totals = computeReportTotals(
      [
        createReportLine({
          id: "1",
          group: "BBVA",
          currency: "ars",
          amount: 30_000,
          year: 2026,
          month: 1,
        }),
        createReportLine({
          id: "2",
          group: "BBVA",
          currency: "ars",
          amount: null,
          year: 2026,
          month: 1,
        }),
      ],
      rates
    )

    // RF-06: un importe faltante no es un cero.
    expect(totals.totalArs.toString()).toBe("30000")
    expect(totals.isComplete).toBe(false)
  })

  it("deja fuera la línea en USD de un mes sin cotización guardada", () => {
    const totals = computeReportTotals(
      [
        createReportLine({
          id: "1",
          group: "Visa",
          currency: "usd",
          amount: 100,
          year: 2026,
          month: 3,
        }),
      ],
      rates
    )

    expect(totals.totalArs.toString()).toBe("0")
    expect(totals.isComplete).toBe(false)
  })

  it("no suma una moneda que la app no sabe leer", () => {
    const totals = computeReportTotals(
      [
        createReportLine({
          id: "1",
          group: "BBVA",
          currency: "eur",
          amount: 100,
          year: 2026,
          month: 1,
        }),
      ],
      rates
    )

    expect(totals.subtotals[0]?.currency).toBeNull()
    expect(totals.subtotals[0]?.originalAmount).toBeNull()
    expect(totals.totalArs.toString()).toBe("0")
    expect(totals.isComplete).toBe(false)
  })
})
