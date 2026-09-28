import { describe, expect, it } from "vitest"

import {
  type DuplicateCandidate,
  findPossibleDuplicate,
  formatInstallment,
} from "@/shared/lib/duplicate-expense"

const netflix: DuplicateCandidate = {
  group: "BBVA",
  concept: "Netflix",
  currency: "ars",
  amount: 12_500,
  installment: "3/6",
}

describe("findPossibleDuplicate", () => {
  it("encuentra el gasto idéntico ya cargado", () => {
    expect(findPossibleDuplicate(netflix, [netflix])).toEqual(netflix)
  })

  it("ignora mayúsculas y espacios al borde del concepto", () => {
    const draft = { ...netflix, concept: "  nETFLIX " }

    expect(findPossibleDuplicate(draft, [netflix])).toEqual(netflix)
  })

  it("no avisa cuando cambia la moneda, el importe, la cuota o el grupo", () => {
    const different: DuplicateCandidate[] = [
      { ...netflix, currency: "usd" },
      { ...netflix, amount: 12_500.5 },
      { ...netflix, installment: "4/6" },
      { ...netflix, installment: null },
      { ...netflix, group: "Supervielle" },
      { ...netflix, concept: "Netflix familiar" },
    ]

    for (const candidate of different) {
      expect(findPossibleDuplicate(netflix, [candidate])).toBeNull()
    }
  })

  it("trata dos gastos sin cuota como comparables entre sí", () => {
    const expense: DuplicateCandidate = {
      group: "Otros gastos",
      concept: "Supermercado",
      currency: "ars",
      amount: 85_000,
      installment: null,
    }

    expect(findPossibleDuplicate(expense, [expense])).toEqual(expense)
  })

  it("devuelve null cuando el mes todavía no tiene nada cargado", () => {
    expect(findPossibleDuplicate(netflix, [])).toBeNull()
  })

  it("devuelve la primera coincidencia de la lista", () => {
    const other: DuplicateCandidate = { ...netflix, concept: "Spotify" }

    expect(findPossibleDuplicate(netflix, [other, netflix])).toEqual(netflix)
  })
})

describe("formatInstallment", () => {
  it("arma la cuota solo cuando conoce los dos números", () => {
    expect(formatInstallment(3, 6)).toBe("3/6")
    expect(formatInstallment(null, 6)).toBeNull()
    expect(formatInstallment(3, null)).toBeNull()
  })
})
