import { describe, expect, it } from "vitest"

import {
  formatScopeLabel,
  isPeriodInScope,
  scopeCacheKey,
  scopeYearBounds,
} from "../../model/report-scope"

describe("isPeriodInScope", () => {
  it("un mes puntual solo incluye ese mes", () => {
    const scope = { kind: "month", period: { year: 2026, month: 3 } } as const

    expect(isPeriodInScope({ year: 2026, month: 3 }, scope)).toBe(true)
    expect(isPeriodInScope({ year: 2026, month: 4 }, scope)).toBe(false)
  })

  it("un rango incluye sus extremos y cruza el cambio de año", () => {
    const scope = {
      kind: "range",
      start: { year: 2025, month: 11 },
      end: { year: 2026, month: 2 },
    } as const

    expect(isPeriodInScope({ year: 2025, month: 11 }, scope)).toBe(true)
    expect(isPeriodInScope({ year: 2025, month: 12 }, scope)).toBe(true)
    expect(isPeriodInScope({ year: 2026, month: 2 }, scope)).toBe(true)
    // Mismo año que el extremo, pero fuera del rango de meses.
    expect(isPeriodInScope({ year: 2025, month: 10 }, scope)).toBe(false)
    expect(isPeriodInScope({ year: 2026, month: 3 }, scope)).toBe(false)
  })

  it("todo el historial no filtra ningún mes", () => {
    expect(isPeriodInScope({ year: 1999, month: 1 }, { kind: "all" })).toBe(
      true
    )
  })
})

describe("scopeYearBounds", () => {
  it("acota los años del rango y no acota el historial completo", () => {
    expect(
      scopeYearBounds({
        kind: "range",
        start: { year: 2025, month: 11 },
        end: { year: 2026, month: 2 },
      })
    ).toEqual({ minYear: 2025, maxYear: 2026 })
    expect(scopeYearBounds({ kind: "all" })).toEqual({
      minYear: null,
      maxYear: null,
    })
  })
})

describe("scopeCacheKey y etiqueta", () => {
  it("distingue alcances distintos", () => {
    expect(
      scopeCacheKey({ kind: "month", period: { year: 2026, month: 3 } })
    ).not.toBe(
      scopeCacheKey({ kind: "month", period: { year: 2026, month: 4 } })
    )
    expect(
      formatScopeLabel({
        kind: "range",
        start: { year: 2026, month: 1 },
        end: { year: 2026, month: 3 },
      })
    ).toBe("Enero de 2026 a Marzo de 2026")
  })
})
