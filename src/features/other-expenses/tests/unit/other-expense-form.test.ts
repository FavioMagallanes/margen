import { describe, expect, it } from "vitest"

import {
  formatOtherExpenseAmountInput,
  fromStoredPaymentMethod,
  otherExpenseSchema,
  toStoredPaymentMethod,
} from "@/features/other-expenses/model/other-expense-form"

const baseValues = {
  concept: "Supermercado",
  amount: "85.000",
  currency: "ars",
  paymentMethod: "none",
  paymentMethodText: "",
} as const

describe("otherExpenseSchema", () => {
  it("acepta un gasto en pesos sin medio de pago", () => {
    const result = otherExpenseSchema.safeParse(baseValues)

    expect(result.success).toBe(true)
  })

  it("acepta un gasto en dólares", () => {
    const result = otherExpenseSchema.safeParse({
      ...baseValues,
      currency: "usd",
    })

    expect(result.success).toBe(true)
    expect(result.success && result.data.currency).toBe("usd")
  })

  it("rechaza un concepto vacío", () => {
    expect(
      otherExpenseSchema.safeParse({ ...baseValues, concept: "   " }).success
    ).toBe(false)
  })

  it("rechaza un importe vacío, en cero o sin dígitos", () => {
    for (const amount of ["", "0", "0,00", "abc"]) {
      expect(
        otherExpenseSchema.safeParse({ ...baseValues, amount }).success
      ).toBe(false)
    }
  })

  it("rechaza una moneda que no sea ars o usd", () => {
    expect(
      otherExpenseSchema.safeParse({ ...baseValues, currency: "eur" }).success
    ).toBe(false)
  })

  it("acepta los tres medios de pago fijos", () => {
    for (const paymentMethod of ["debit", "transfer", "cash"]) {
      expect(
        otherExpenseSchema.safeParse({ ...baseValues, paymentMethod }).success
      ).toBe(true)
    }
  })

  it("exige el texto libre cuando el medio de pago es «Otro»", () => {
    const result = otherExpenseSchema.safeParse({
      ...baseValues,
      paymentMethod: "other",
      paymentMethodText: "  ",
    })

    expect(result.success).toBe(false)
    expect(
      !result.success &&
        result.error.issues.some(
          (issue) => issue.path[0] === "paymentMethodText"
        )
    ).toBe(true)

    expect(
      otherExpenseSchema.safeParse({
        ...baseValues,
        paymentMethod: "other",
        paymentMethodText: "Rapipago",
      }).success
    ).toBe(true)
  })
})

describe("toStoredPaymentMethod", () => {
  it("guarda null cuando el medio de pago quedó sin especificar", () => {
    expect(toStoredPaymentMethod({ ...baseValues })).toBeNull()
  })

  it("guarda la etiqueta de los medios de pago fijos", () => {
    expect(
      toStoredPaymentMethod({ ...baseValues, paymentMethod: "debit" })
    ).toBe("Débito")
    expect(
      toStoredPaymentMethod({ ...baseValues, paymentMethod: "transfer" })
    ).toBe("Transferencia")
    expect(
      toStoredPaymentMethod({ ...baseValues, paymentMethod: "cash" })
    ).toBe("Efectivo")
  })

  it("guarda el texto libre cuando el medio de pago es «Otro»", () => {
    expect(
      toStoredPaymentMethod({
        ...baseValues,
        paymentMethod: "other",
        paymentMethodText: "  Rapipago ",
      })
    ).toBe("Rapipago")
  })
})

describe("fromStoredPaymentMethod", () => {
  it("reconstruye la selección de un medio de pago fijo", () => {
    expect(fromStoredPaymentMethod("Efectivo")).toEqual({
      paymentMethod: "cash",
      paymentMethodText: "",
    })
  })

  it("trata cualquier otro texto como «Otro» y lo conserva", () => {
    expect(fromStoredPaymentMethod("Rapipago")).toEqual({
      paymentMethod: "other",
      paymentMethodText: "Rapipago",
    })
  })

  it("trata la ausencia de medio de pago como «Sin especificar»", () => {
    expect(fromStoredPaymentMethod(null)).toEqual({
      paymentMethod: "none",
      paymentMethodText: "",
    })
  })
})

describe("formatOtherExpenseAmountInput", () => {
  it("prellena el importe con el formato del campo de montos", () => {
    expect(formatOtherExpenseAmountInput(85_000)).toBe("85.000,00")
  })
})
