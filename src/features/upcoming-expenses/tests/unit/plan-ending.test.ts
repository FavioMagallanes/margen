import { describe, expect, it } from "vitest"

import {
  type FinitePlan,
  planEndingPeriod,
  toUpcomingPlanEndings,
} from "@/features/upcoming-expenses/model/plan-ending"

const period = { year: 2026, month: 5 }

const createPlan = (plan: Partial<FinitePlan>): FinitePlan => ({
  planId: "plan-1",
  concept: "Notebook",
  groupLabel: "Visa",
  kind: "card_purchase",
  totalInstallments: 6,
  firstPeriod: { year: 2026, month: 3 },
  stoppedFrom: null,
  ...plan,
})

describe("planEndingPeriod", () => {
  it("cuenta la primera cuota como parte del plan", () => {
    expect(planEndingPeriod({ year: 2026, month: 3 }, 6)).toEqual({
      year: 2026,
      month: 8,
    })
  })

  it("cruza el cambio de año sumando meses calendario", () => {
    expect(planEndingPeriod({ year: 2026, month: 11 }, 12)).toEqual({
      year: 2027,
      month: 10,
    })
  })

  it("termina en su propio mes cuando el plan es de una sola cuota", () => {
    expect(planEndingPeriod({ year: 2026, month: 3 }, 1)).toEqual({
      year: 2026,
      month: 3,
    })
  })
})

describe("toUpcomingPlanEndings", () => {
  it("ordena los planes vigentes por mes de fin ascendente", () => {
    const endings = toUpcomingPlanEndings(
      [
        createPlan({
          planId: "loan",
          concept: "Préstamo auto",
          kind: "loan",
          totalInstallments: 24,
          firstPeriod: { year: 2026, month: 1 },
        }),
        createPlan({ planId: "card", totalInstallments: 6 }),
      ],
      period
    )

    expect(endings.map((ending) => ending.planId)).toEqual(["card", "loan"])
    expect(endings.map((ending) => ending.endsAt)).toEqual([
      { year: 2026, month: 8 },
      { year: 2027, month: 12 },
    ])
  })

  it("mantiene el plan que termina en el mes que se está viendo", () => {
    const endings = toUpcomingPlanEndings(
      [
        createPlan({
          firstPeriod: { year: 2026, month: 3 },
          totalInstallments: 3,
        }),
      ],
      period
    )

    expect(endings).toHaveLength(1)
  })

  it("deja fuera el plan que ya terminó antes del mes que se está viendo", () => {
    const endings = toUpcomingPlanEndings(
      [
        createPlan({
          firstPeriod: { year: 2026, month: 1 },
          totalInstallments: 3,
        }),
      ],
      period
    )

    expect(endings).toEqual([])
  })

  it("deja fuera un recurrente detenido y uno sin ninguna ocurrencia", () => {
    const endings = toUpcomingPlanEndings(
      [
        createPlan({
          planId: "stopped",
          kind: "recurring",
          totalInstallments: 12,
          stoppedFrom: { year: 2026, month: 4 },
        }),
        createPlan({ planId: "never-generated", firstPeriod: null }),
      ],
      period
    )

    expect(endings).toEqual([])
  })

  it("calcula el fin aunque el plan todavía no haya generado todas sus cuotas", () => {
    const [ending] = toUpcomingPlanEndings(
      [
        createPlan({
          firstPeriod: { year: 2026, month: 4 },
          totalInstallments: 18,
        }),
      ],
      period
    )

    expect(ending?.endsAt).toEqual({ year: 2027, month: 9 })
  })
})
