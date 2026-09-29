import { describe, expect, it } from "vitest"

import type { RecurringPlan } from "@/features/recurring-expenses/model/recurring-plans"
import {
  classifyUpcomingLine,
  toProjectedRecurringLines,
  type UpcomingExpenseLine,
} from "@/features/upcoming-expenses/model/upcoming-line"

const onlyLine = (
  lines: readonly UpcomingExpenseLine[]
): UpcomingExpenseLine => {
  const [line] = lines

  if (line === undefined) {
    throw new Error("Se esperaba una línea proyectada.")
  }

  return line
}

const period = { year: 2026, month: 5 }

const createPlan = (plan: Partial<RecurringPlan>): RecurringPlan => ({
  planId: "plan-1",
  concept: "Luz",
  groupLabel: "Servicios",
  currency: "ars",
  defaultAmount: null,
  totalInstallments: null,
  stoppedFrom: null,
  occurrences: [],
  ...plan,
})

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

describe("toProjectedRecurringLines", () => {
  it("proyecta el importe fijo de un recurrente sin ocurrencia del mes", () => {
    const lines = toProjectedRecurringLines(
      [createPlan({ defaultAmount: 30_000 })],
      period
    )

    expect(lines).toHaveLength(1)
    expect(onlyLine(lines)).toMatchObject({
      concept: "Luz",
      group: "Servicios",
      currency: "ars",
      amount: 30_000,
      origin: "projected",
      kind: "recurring",
      amountIsEstimated: false,
    })
    expect(classifyUpcomingLine(onlyLine(lines))).toBe("known")
  })

  it("proyecta el último importe real de un recurrente variable como estimado", () => {
    const lines = toProjectedRecurringLines(
      [
        createPlan({
          occurrences: [
            { year: 2026, month: 3, amount: 18_000, isSkipped: false },
            { year: 2026, month: 4, amount: 21_500, isSkipped: false },
          ],
        }),
      ],
      period
    )

    expect(onlyLine(lines).amount).toBe(21_500)
    expect(classifyUpcomingLine(onlyLine(lines))).toBe("estimated")
  })

  it("deja sin importe un recurrente variable sin ningún historial", () => {
    const lines = toProjectedRecurringLines([createPlan({})], period)

    expect(onlyLine(lines).amount).toBeNull()
    expect(classifyUpcomingLine(onlyLine(lines))).toBe("missing")
  })

  it("no proyecta un recurrente detenido, agotado o ya generado", () => {
    const plans = [
      createPlan({
        planId: "stopped",
        defaultAmount: 30_000,
        stoppedFrom: { year: 2026, month: 4 },
      }),
      createPlan({
        planId: "exhausted",
        defaultAmount: 30_000,
        totalInstallments: 2,
        occurrences: [
          { year: 2026, month: 3, amount: 30_000, isSkipped: false },
          { year: 2026, month: 4, amount: 30_000, isSkipped: false },
        ],
      }),
      createPlan({
        planId: "already-generated",
        defaultAmount: 30_000,
        occurrences: [{ year: 2026, month: 5, amount: null, isSkipped: false }],
      }),
    ]

    expect(toProjectedRecurringLines(plans, period)).toEqual([])
  })
})
