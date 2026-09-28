import { describe, expect, it } from "vitest"

import {
  computeCaretIndexAfterFormat,
  formatAmountInputValue,
  parseAmountInputValue,
} from "@/shared/lib/amount-input"

describe("formatAmountInputValue", () => {
  it("agrega los puntos de miles mientras se tipea dígito a dígito", () => {
    const typed = "1500000"
    const shown = [...typed].reduce<string[]>((steps, digit) => {
      const previous = steps.at(-1) ?? ""

      return [...steps, formatAmountInputValue(`${previous}${digit}`)]
    }, [])

    expect(shown).toEqual([
      "1",
      "15",
      "150",
      "1.500",
      "15.000",
      "150.000",
      "1.500.000",
    ])
  })

  it("toma la coma como separador decimal", () => {
    expect(formatAmountInputValue("1.500.000,")).toBe("1.500.000,")
    expect(formatAmountInputValue("1.500.000,5")).toBe("1.500.000,5")
    expect(formatAmountInputValue("1.500.000,50")).toBe("1.500.000,50")
  })

  it("acepta el punto del teclado numérico como separador decimal", () => {
    expect(formatAmountInputValue("1500.")).toBe("1.500,")
    expect(formatAmountInputValue("1500,")).toBe("1.500,")
  })

  it("trata los puntos internos como separadores de miles al borrar un dígito", () => {
    // Borrar el último dígito de "1.500" deja "1.50": el punto sigue siendo
    // separador de miles, no un decimal recién tipeado.
    expect(formatAmountInputValue("1.50")).toBe("150")
    expect(formatAmountInputValue("1.5")).toBe("15")
  })

  it("renormaliza un importe ya formateado que se pega en el campo", () => {
    expect(formatAmountInputValue("1.500.000,50")).toBe("1.500.000,50")
    expect(formatAmountInputValue("1500000,50")).toBe("1.500.000,50")
  })

  it("trunca los decimales a dos dígitos", () => {
    expect(formatAmountInputValue("1500,567")).toBe("1.500,56")
  })

  it("ignora los caracteres que no son dígitos ni separadores", () => {
    expect(formatAmountInputValue("$ 1500 pesos")).toBe("1.500")
    expect(formatAmountInputValue("-1500")).toBe("1.500")
  })

  it("ignora los separadores decimales sobrantes", () => {
    expect(formatAmountInputValue("1,2,3")).toBe("12,3")
    expect(formatAmountInputValue("1500,,")).toBe("1.500,")
  })

  it("completa el entero cuando solo se tipea la coma", () => {
    expect(formatAmountInputValue(",")).toBe("0,")
    expect(formatAmountInputValue(",5")).toBe("0,5")
  })

  it("descarta los ceros a la izquierda sin romper el agrupamiento", () => {
    expect(formatAmountInputValue("007")).toBe("7")
    expect(formatAmountInputValue("0")).toBe("0")
    expect(formatAmountInputValue("0001500")).toBe("1.500")
  })

  it("deja vacío un campo vacío", () => {
    expect(formatAmountInputValue("")).toBe("")
    expect(formatAmountInputValue("abc")).toBe("")
  })
})

describe("parseAmountInputValue", () => {
  it("hace ida y vuelta con el valor formateado", () => {
    const formatted = formatAmountInputValue("1500000,50")

    expect(parseAmountInputValue(formatted)?.toFixed(2)).toBe("1500000.50")
  })

  it("parsea un importe entero formateado", () => {
    expect(parseAmountInputValue("1.500.000")?.toFixed(2)).toBe("1500000.00")
  })

  it("parsea un importe a medio tipear", () => {
    expect(parseAmountInputValue("1.500,")?.toFixed(2)).toBe("1500.00")
    expect(parseAmountInputValue("0,5")?.toFixed(2)).toBe("0.50")
  })

  it("devuelve null cuando no hay un importe que parsear", () => {
    expect(parseAmountInputValue("")).toBeNull()
    expect(parseAmountInputValue("   ")).toBeNull()
    expect(parseAmountInputValue("abc")).toBeNull()
  })
})

describe("computeCaretIndexAfterFormat", () => {
  it("deja el cursor al final cuando se tipea al final", () => {
    expect(computeCaretIndexAfterFormat("1500", 4, "1.500")).toBe(5)
  })

  it("mantiene el cursor junto al dígito recién tipeado en el medio", () => {
    // "150|.000" + "9" => "1509.000", que se reformatea como "1.509.000".
    expect(computeCaretIndexAfterFormat("1509.000", 4, "1.509.000")).toBe(5)
  })

  it("mantiene el cursor al borrar un dígito pegado a un separador", () => {
    // Borrar el "9" de "1.509|.000" deja "1.50|.000" => "150.000".
    expect(computeCaretIndexAfterFormat("1.50.000", 4, "150.000")).toBe(3)
  })

  it("mantiene el cursor al principio cuando no hay dígitos antes", () => {
    expect(computeCaretIndexAfterFormat("1.500", 0, "1.500")).toBe(0)
  })

  it("acota la posición a los límites del texto formateado", () => {
    expect(computeCaretIndexAfterFormat("1500", 99, "1.500")).toBe(5)
    expect(computeCaretIndexAfterFormat("1500", -3, "1.500")).toBe(0)
  })
})
