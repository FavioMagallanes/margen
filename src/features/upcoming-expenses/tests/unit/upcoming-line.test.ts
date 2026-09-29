import { describe, expect, it } from "vitest"

import { classifyUpcomingLine } from "@/features/upcoming-expenses/model/upcoming-line"

describe("classifyUpcomingLine", () => {
  it("trata como conocido un importe cargado y no estimado", () => {
    expect(
      classifyUpcomingLine({ amount: 45_000, amountIsEstimated: false })
    ).toBe("known")
  })

  it("trata como estimado un importe marcado como tal", () => {
    expect(
      classifyUpcomingLine({ amount: 45_000, amountIsEstimated: true })
    ).toBe("estimated")
  })

  it("trata como información faltante un importe ausente, nunca como cero", () => {
    expect(
      classifyUpcomingLine({ amount: null, amountIsEstimated: false })
    ).toBe("missing")
    expect(
      classifyUpcomingLine({ amount: null, amountIsEstimated: true })
    ).toBe("missing")
  })
})
