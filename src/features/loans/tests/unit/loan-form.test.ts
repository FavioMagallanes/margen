import { describe, expect, it } from "vitest"

import {
  loanEditSchema,
  loanSchema,
  parsePositiveInteger,
} from "@/features/loans/model/loan-form"

const baseValues = {
  concept: "Préstamo personal",
  entity: "BBVA",
  quotaAmount: "120.000",
  startingInstallment: "4",
  totalInstallments: "12",
}

const baseEditValues = {
  concept: "Préstamo personal",
  entity: "Mercado Pago",
  totalInstallments: "12",
  editedInstallment: "4",
}

describe("loanSchema", () => {
  it("acepta un préstamo con cuota inicial menor al total", () => {
    const result = loanSchema.safeParse(baseValues)

    expect(result.success).toBe(true)
  })

  it("acepta una entidad que no está entre las sugeridas", () => {
    const result = loanSchema.safeParse({
      ...baseValues,
      entity: "Banco Nación",
    })

    expect(result.success).toBe(true)
    expect(result.success && result.data.entity).toBe("Banco Nación")
  })

  it("rechaza un concepto o una entidad vacíos", () => {
    expect(loanSchema.safeParse({ ...baseValues, concept: "  " }).success).toBe(
      false
    )
    expect(loanSchema.safeParse({ ...baseValues, entity: "" }).success).toBe(
      false
    )
  })

  it("rechaza un importe de cuota vacío o en cero", () => {
    expect(
      loanSchema.safeParse({ ...baseValues, quotaAmount: "" }).success
    ).toBe(false)
    expect(
      loanSchema.safeParse({ ...baseValues, quotaAmount: "0" }).success
    ).toBe(false)
  })

  it("rechaza una cuota inicial mayor al total de cuotas", () => {
    const result = loanSchema.safeParse({
      ...baseValues,
      startingInstallment: "13",
      totalInstallments: "12",
    })

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues[0]?.message).toBe(
      "La cuota inicial no puede superar el total de cuotas"
    )
  })

  it("rechaza números de cuota que no sean enteros positivos", () => {
    expect(
      loanSchema.safeParse({ ...baseValues, startingInstallment: "0" }).success
    ).toBe(false)
    expect(
      loanSchema.safeParse({ ...baseValues, totalInstallments: "2,5" }).success
    ).toBe(false)
  })
})

describe("loanEditSchema", () => {
  it("acepta cambiar concepto, entidad y total de cuotas", () => {
    const result = loanEditSchema.safeParse({
      ...baseEditValues,
      totalInstallments: "18",
    })

    expect(result.success).toBe(true)
  })

  it("rechaza un total menor a la cuota que se está editando", () => {
    const result = loanEditSchema.safeParse({
      ...baseEditValues,
      totalInstallments: "3",
    })

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues[0]?.message).toBe(
      "El total de cuotas no puede ser menor a la cuota que estás editando"
    )
  })

  it("acepta un total igual a la cuota editada, que pasa a ser la última", () => {
    const result = loanEditSchema.safeParse({
      ...baseEditValues,
      totalInstallments: "4",
    })

    expect(result.success).toBe(true)
  })
})

describe("parsePositiveInteger", () => {
  it("solo acepta enteros positivos escritos como texto", () => {
    expect(parsePositiveInteger(" 12 ")).toBe(12)
    expect(parsePositiveInteger("0")).toBeNull()
    expect(parsePositiveInteger("1.5")).toBeNull()
    expect(parsePositiveInteger("")).toBeNull()
  })
})
