import { Decimal } from "decimal.js"
import { describe, expect, it } from "vitest"

import {
  convertUsdToArs,
  formatArs,
  roundArs,
  sumArs,
} from "@/shared/lib/money"

describe("roundArs", () => {
  it("redondea hacia arriba cuando el tercer decimal es exactamente 5", () => {
    expect(roundArs("10.005").toFixed(2)).toBe("10.01")
  })

  it("redondea hacia abajo cuando el tercer decimal es menor que 5", () => {
    expect(roundArs("10.004").toFixed(2)).toBe("10.00")
  })

  it("conserva un importe que ya tiene dos decimales", () => {
    expect(roundArs(1234.56).toFixed(2)).toBe("1234.56")
  })

  it("mantiene el signo de un importe negativo", () => {
    expect(roundArs("-10.005").toFixed(2)).toBe("-10.01")
  })
})

describe("convertUsdToArs", () => {
  it("convierte con la cotización del mes y redondea a dos decimales", () => {
    expect(convertUsdToArs(12.99, 1640).toFixed(2)).toBe("21303.60")
  })

  it("redondea el equivalente antes de devolverlo", () => {
    // 0.015 * 1.67 = 0.02505 -> 0.03 con mitad para arriba en el tercer decimal.
    expect(convertUsdToArs("0.015", "1.67").toFixed(2)).toBe("0.03")
  })
})

describe("sumArs", () => {
  it("suma renglones ya redondeados sin perder precisión", () => {
    const lines = [roundArs("0.1"), roundArs("0.2"), roundArs("0.3")]

    expect(sumArs(lines).toFixed(2)).toBe("0.60")
  })

  it("devuelve cero para una lista vacía", () => {
    expect(sumArs([]).toFixed(2)).toBe("0.00")
  })

  it("coincide con la suma de los renglones visibles convertidos", () => {
    const lines = [
      roundArs(45_000),
      convertUsdToArs(62, 1640),
      convertUsdToArs(12.99, 1640),
    ]

    expect(sumArs(lines).toFixed(2)).toBe("167983.60")
  })
})

describe("formatArs", () => {
  it("muestra el importe en pesos con dos decimales", () => {
    expect(formatArs(new Decimal("1850000.5"))).toContain("1.850.000,50")
  })

  it("muestra un importe negativo como negativo", () => {
    expect(formatArs(new Decimal("-1234.5"))).toContain("1.234,50")
    expect(formatArs(new Decimal("-1234.5")).startsWith("-")).toBe(true)
  })
})
