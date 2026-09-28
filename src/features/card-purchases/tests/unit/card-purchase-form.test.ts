import { describe, expect, it } from "vitest"

import {
  cardPurchaseSchema,
  parsePositiveInteger,
} from "@/features/card-purchases/model/card-purchase-form"

const baseValues = {
  concept: "Notebook",
  card: "BBVA",
  currency: "ars",
  quotaAmount: "45.000",
  isSinglePayment: false,
  startingInstallment: "3",
  totalInstallments: "6",
  year: "2026",
  month: "9",
}

describe("cardPurchaseSchema", () => {
  it("acepta una compra en cuotas con cuota inicial menor al total", () => {
    const result = cardPurchaseSchema.safeParse(baseValues)

    expect(result.success).toBe(true)
    expect(result.success && result.data.startingInstallment).toBe("3")
    expect(result.success && result.data.totalInstallments).toBe("6")
  })

  it("fija cuota 1 de 1 cuando la compra es «Un pago»", () => {
    const result = cardPurchaseSchema.safeParse({
      ...baseValues,
      isSinglePayment: true,
      startingInstallment: "",
      totalInstallments: "",
    })

    expect(result.success).toBe(true)
    expect(result.success && result.data.startingInstallment).toBe("1")
    expect(result.success && result.data.totalInstallments).toBe("1")
  })

  it("rechaza una cuota inicial mayor al total de cuotas", () => {
    const result = cardPurchaseSchema.safeParse({
      ...baseValues,
      startingInstallment: "7",
      totalInstallments: "6",
    })

    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues[0]?.message).toBe(
      "La cuota inicial no puede superar el total de cuotas"
    )
  })

  it("rechaza un importe de cuota vacío o en cero", () => {
    expect(
      cardPurchaseSchema.safeParse({ ...baseValues, quotaAmount: "" }).success
    ).toBe(false)
    expect(
      cardPurchaseSchema.safeParse({ ...baseValues, quotaAmount: "0" }).success
    ).toBe(false)
    expect(
      cardPurchaseSchema.safeParse({ ...baseValues, quotaAmount: "0,01" })
        .success
    ).toBe(true)
  })

  it("rechaza un concepto vacío o solo con espacios", () => {
    expect(
      cardPurchaseSchema.safeParse({ ...baseValues, concept: "   " }).success
    ).toBe(false)
  })

  it("rechaza una tarjeta o un mes fuera de las opciones válidas", () => {
    expect(
      cardPurchaseSchema.safeParse({ ...baseValues, card: "Galicia" }).success
    ).toBe(false)
    expect(
      cardPurchaseSchema.safeParse({ ...baseValues, month: "13" }).success
    ).toBe(false)
  })
})

describe("parsePositiveInteger", () => {
  it("solo acepta enteros positivos escritos con dígitos", () => {
    expect(parsePositiveInteger("6")).toBe(6)
    expect(parsePositiveInteger(" 12 ")).toBe(12)
    expect(parsePositiveInteger("0")).toBeNull()
    expect(parsePositiveInteger("1,5")).toBeNull()
    expect(parsePositiveInteger("-3")).toBeNull()
    expect(parsePositiveInteger("")).toBeNull()
  })
})
