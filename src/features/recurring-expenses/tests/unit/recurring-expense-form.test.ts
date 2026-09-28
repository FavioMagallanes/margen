import { describe, expect, it } from "vitest"

import {
  recurringEditSchema,
  recurringSchema,
  toCreateRecurringPlanInput,
  toRecurringPlanInput,
} from "@/features/recurring-expenses/model/recurring-expense-form"

const baseValues = {
  concept: "Internet",
  groupLabel: "Otros gastos" as const,
  currency: "ars" as const,
  amountMode: "fixed" as const,
  startingAmount: "45.000",
  duration: "untilStopped" as const,
  totalMonths: "",
}

const baseEditValues = {
  concept: "Internet",
  groupLabel: "Otros gastos" as const,
  currency: "ars" as const,
  amountMode: "fixed" as const,
  defaultAmount: "48.000",
  duration: "untilStopped" as const,
  totalMonths: "",
}

describe("recurringSchema", () => {
  it("acepta un recurrente mensual hasta detener sin cantidad de meses", () => {
    expect(recurringSchema.safeParse(baseValues).success).toBe(true)
  })

  it("rechaza un concepto vacío", () => {
    expect(
      recurringSchema.safeParse({ ...baseValues, concept: "   " }).success
    ).toBe(false)
  })

  it("rechaza un grupo que no esté entre las tres opciones", () => {
    expect(
      recurringSchema.safeParse({ ...baseValues, groupLabel: "Galicia" })
        .success
    ).toBe(false)
  })

  it("rechaza el importe del primer mes vacío o en cero", () => {
    expect(
      recurringSchema.safeParse({ ...baseValues, startingAmount: "" }).success
    ).toBe(false)
    expect(
      recurringSchema.safeParse({ ...baseValues, startingAmount: "0" }).success
    ).toBe(false)
  })

  it("exige una cantidad de meses entera y positiva solo cuando es finito", () => {
    expect(
      recurringSchema.safeParse({ ...baseValues, duration: "months" }).success
    ).toBe(false)
    expect(
      recurringSchema.safeParse({
        ...baseValues,
        duration: "months",
        totalMonths: "2,5",
      }).success
    ).toBe(false)
    expect(
      recurringSchema.safeParse({
        ...baseValues,
        duration: "months",
        totalMonths: "0",
      }).success
    ).toBe(false)
    expect(
      recurringSchema.safeParse({
        ...baseValues,
        duration: "months",
        totalMonths: "6",
      }).success
    ).toBe(true)
  })
})

describe("toCreateRecurringPlanInput", () => {
  it("repite el importe del primer mes como importe fijo del plan", () => {
    expect(toCreateRecurringPlanInput(baseValues)).toEqual({
      concept: "Internet",
      groupLabel: "Otros gastos",
      currency: "ars",
      defaultAmount: 45_000,
      totalInstallments: null,
      startingAmount: 45_000,
    })
  })

  it("deja el importe fijo en null cuando el importe es variable", () => {
    expect(
      toCreateRecurringPlanInput({ ...baseValues, amountMode: "variable" })
    ).toEqual(
      expect.objectContaining({ defaultAmount: null, startingAmount: 45_000 })
    )
  })

  it("traduce «una sola vez» a un único mes y los meses fijos a su total", () => {
    expect(
      toCreateRecurringPlanInput({ ...baseValues, duration: "once" })
    ).toEqual(expect.objectContaining({ totalInstallments: 1 }))
    expect(
      toCreateRecurringPlanInput({
        ...baseValues,
        duration: "months",
        totalMonths: "6",
      })
    ).toEqual(expect.objectContaining({ totalInstallments: 6 }))
  })
})

describe("recurringEditSchema", () => {
  it("acepta la edición de un plan de importe fijo", () => {
    expect(recurringEditSchema.safeParse(baseEditValues).success).toBe(true)
  })

  it("exige el importe fijo solo cuando el plan es de importe fijo", () => {
    expect(
      recurringEditSchema.safeParse({ ...baseEditValues, defaultAmount: "" })
        .success
    ).toBe(false)
    expect(
      recurringEditSchema.safeParse({
        ...baseEditValues,
        amountMode: "variable",
        defaultAmount: "",
      }).success
    ).toBe(true)
  })
})

describe("toRecurringPlanInput", () => {
  it("convierte el importe fijo editado y la duración finita", () => {
    expect(
      toRecurringPlanInput({
        ...baseEditValues,
        duration: "months",
        totalMonths: "12",
      })
    ).toEqual({
      concept: "Internet",
      groupLabel: "Otros gastos",
      currency: "ars",
      defaultAmount: 48_000,
      totalInstallments: 12,
    })
  })

  it("olvida el importe fijo cuando el plan pasa a ser variable", () => {
    expect(
      toRecurringPlanInput({ ...baseEditValues, amountMode: "variable" })
    ).toEqual(
      expect.objectContaining({ defaultAmount: null, totalInstallments: null })
    )
  })
})
