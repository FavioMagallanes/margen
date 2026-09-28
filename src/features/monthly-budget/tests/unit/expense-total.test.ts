import { describe, expect, it } from "vitest"

import {
  computeExpenseGroupTotals,
  computeExpenseTotal,
  type ExpenseLine,
} from "@/features/monthly-budget/model/expense-total"

const line = (overrides: Partial<ExpenseLine>): ExpenseLine => ({
  id: "line",
  concept: "Concepto",
  group: "BBVA",
  installment: null,
  amount: 1000,
  currency: "ars",
  ...overrides,
})

describe("computeExpenseTotal", () => {
  it("suma los consumos ARS y el equivalente ARS de los USD", () => {
    const total = computeExpenseTotal(
      [
        line({ amount: 45_000, currency: "ars" }),
        line({ amount: 12.99, currency: "usd" }),
      ],
      1640
    )

    expect(total.totalKnownArs.toFixed(2)).toBe("66303.60")
    expect(total.isComplete).toBe(true)
  })

  it("no trata un importe faltante como cero", () => {
    const total = computeExpenseTotal(
      [line({ amount: 10_000 }), line({ amount: null })],
      1640
    )

    expect(total.totalKnownArs.toFixed(2)).toBe("10000.00")
    expect(total.isComplete).toBe(false)
  })

  it("marca el total como incompleto si falta la cotización del mes", () => {
    const total = computeExpenseTotal(
      [line({ amount: 10_000 }), line({ amount: 50, currency: "usd" })],
      null
    )

    expect(total.totalKnownArs.toFixed(2)).toBe("10000.00")
    expect(total.isComplete).toBe(false)
  })

  it("devuelve un total completo en cero cuando el mes no tiene gastos", () => {
    const total = computeExpenseTotal([], null)

    expect(total.totalKnownArs.toFixed(2)).toBe("0.00")
    expect(total.isComplete).toBe(true)
  })
})

describe("computeExpenseGroupTotals", () => {
  it("arma los grupos a partir de los datos, sin una lista fija", () => {
    const totals = computeExpenseGroupTotals(
      [
        line({ group: "BBVA", amount: 1000 }),
        line({ group: "Otros gastos", amount: 500 }),
        line({ group: "BBVA", amount: 250 }),
      ],
      null
    )

    expect(totals.map((total) => total.group)).toEqual(["BBVA", "Otros gastos"])
    expect(totals.map((total) => total.totalKnownArs.toFixed(2))).toEqual([
      "1250.00",
      "500.00",
    ])
  })
})
