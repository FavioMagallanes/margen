import { describe, expect, it } from "vitest"

import { formatSalaryInput, salaryResolver } from "../../model/salary-form"

const resolve = (salary: string) =>
  salaryResolver({ salary }, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  })

describe("salaryResolver", () => {
  it("acepta un importe formateado al estilo argentino", async () => {
    const { values, errors } = await resolve("1.500.000,50")

    expect(errors).toEqual({})
    expect(values).toEqual({ salary: "1.500.000,50" })
  })

  it("acepta un sueldo en cero", async () => {
    const { errors } = await resolve("0")

    expect(errors).toEqual({})
  })

  it("rechaza un campo vacío o sin dígitos", async () => {
    expect((await resolve("")).errors.salary?.message).toBe(
      "Ingresá un importe en pesos, sin signos y hasta 2 decimales"
    )
    expect((await resolve("abc")).errors.salary).toBeDefined()
  })
})

describe("formatSalaryInput", () => {
  it("prefills el campo con el formato que muestra AmountInput", () => {
    expect(formatSalaryInput(1_500_000.5)).toBe("1.500.000,50")
    expect(formatSalaryInput(1_200_000)).toBe("1.200.000,00")
  })
})
