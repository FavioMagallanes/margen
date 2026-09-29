import { describe, expect, it } from "vitest"

import {
  addMonths,
  formatPeriodLabel,
  getCurrentPeriod,
  getWorkingPeriod,
  isSamePeriod,
  parsePeriod,
} from "@/shared/lib/period"

describe("getCurrentPeriod", () => {
  it("devuelve el mes calendario en base 1", () => {
    expect(getCurrentPeriod(new Date(2026, 8, 15))).toEqual({
      year: 2026,
      month: 9,
    })
  })
})

describe("getWorkingPeriod", () => {
  it("devuelve el mes calendario real más uno", () => {
    expect(getWorkingPeriod(new Date(2026, 8, 15))).toEqual({
      year: 2026,
      month: 10,
    })
  })

  it("pasa de diciembre a enero del año siguiente", () => {
    expect(getWorkingPeriod(new Date(2026, 11, 31))).toEqual({
      year: 2027,
      month: 1,
    })
  })
})

describe("addMonths", () => {
  it("avanza de diciembre a enero cambiando de año", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    })
  })

  it("retrocede de enero a diciembre cambiando de año", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    })
  })
})

describe("parsePeriod", () => {
  it("acepta parámetros de ruta válidos", () => {
    expect(parsePeriod("2026", "9")).toEqual({ year: 2026, month: 9 })
  })

  it("rechaza meses fuera de rango y valores no numéricos", () => {
    expect(parsePeriod("2026", "13")).toBeNull()
    expect(parsePeriod("2026", "0")).toBeNull()
    expect(parsePeriod("20x6", "9")).toBeNull()
    expect(parsePeriod(undefined, undefined)).toBeNull()
  })
})

describe("formatPeriodLabel", () => {
  it("muestra el mes en español con la inicial en mayúscula", () => {
    expect(formatPeriodLabel({ year: 2026, month: 9 })).toBe(
      "Septiembre de 2026"
    )
  })
})

describe("isSamePeriod", () => {
  it("compara año y mes", () => {
    expect(
      isSamePeriod({ year: 2026, month: 9 }, { year: 2026, month: 9 })
    ).toBe(true)
    expect(
      isSamePeriod({ year: 2026, month: 9 }, { year: 2025, month: 9 })
    ).toBe(false)
  })
})
