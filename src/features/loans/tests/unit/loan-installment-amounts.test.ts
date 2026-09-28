import { describe, expect, it } from "vitest"

import {
  countMissingInstallmentsUpTo,
  parseLoanInstallmentAmounts,
  type PendingLoanInstallment,
} from "@/features/loans/model/loan-installment-amounts"

describe("parseLoanInstallmentAmounts", () => {
  it("convierte solo las cuotas completadas y deja fuera las vacías", () => {
    const result = parseLoanInstallmentAmounts({
      "occurrence-1": "117.500",
      "occurrence-2": "",
      "occurrence-3": "115.000,50",
    })

    expect(result).toEqual({
      status: "valid",
      amounts: [
        { occurrenceId: "occurrence-1", amount: 117_500 },
        { occurrenceId: "occurrence-3", amount: 115_000.5 },
      ],
    })
  })

  it("avisa cuando no se completó ningún importe", () => {
    expect(
      parseLoanInstallmentAmounts({ "occurrence-1": "", "occurrence-2": "  " })
    ).toEqual({ status: "empty" })
  })

  it("rechaza un importe en cero e identifica la cuota con el error", () => {
    const result = parseLoanInstallmentAmounts({
      "occurrence-1": "0",
      "occurrence-2": "120.000",
    })

    expect(result.status).toBe("invalid")
    expect(result.status === "invalid" && result.errors).toEqual({
      "occurrence-1": "Ingresá un importe mayor a cero o dejá la cuota vacía",
    })
  })
})

describe("countMissingInstallmentsUpTo", () => {
  const installments: PendingLoanInstallment[] = [
    {
      occurrenceId: "occurrence-1",
      year: 2025,
      month: 12,
      installmentNumber: 2,
    },
    {
      occurrenceId: "occurrence-2",
      year: 2026,
      month: 3,
      installmentNumber: 5,
    },
    {
      occurrenceId: "occurrence-3",
      year: 2026,
      month: 4,
      installmentNumber: 6,
    },
  ]

  it("cuenta las cuotas sin importe del mes visto y de los anteriores", () => {
    expect(
      countMissingInstallmentsUpTo(installments, { year: 2026, month: 3 })
    ).toBe(2)
  })

  it("no cuenta las cuotas futuras, que todavía no tienen por qué tener importe", () => {
    expect(
      countMissingInstallmentsUpTo(installments, { year: 2025, month: 11 })
    ).toBe(0)
  })
})
