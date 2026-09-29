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
  totalInstallments: 6,
  knownOccurrence: {
    period: { year: 2026, month: 3 },
    installmentNumber: 1,
  },
  stoppedFrom: null,
  ...plan,
})

describe("planEndingPeriod", () => {
  it("cuenta la primera cuota como parte del plan", () => {
    expect(planEndingPeriod({ year: 2026, month: 3 }, 1, 6)).toEqual({
      year: 2026,
      month: 8,
    })
  })

  it("cruza el cambio de año sumando meses calendario", () => {
    expect(planEndingPeriod({ year: 2026, month: 11 }, 1, 12)).toEqual({
      year: 2027,
      month: 10,
    })
  })

  it("termina en su propio mes cuando el plan es de una sola cuota", () => {
    expect(planEndingPeriod({ year: 2026, month: 3 }, 1, 1)).toEqual({
      year: 2026,
      month: 3,
    })
  })

  it("termina en el mes de la última cuota cuando la ocurrencia conocida es la última", () => {
    expect(planEndingPeriod({ year: 2026, month: 9 }, 3, 3)).toEqual({
      year: 2026,
      month: 9,
    })
  })

  it("cuenta solo las cuotas que faltan desde una cuota intermedia", () => {
    expect(planEndingPeriod({ year: 2026, month: 5 }, 2, 5)).toEqual({
      year: 2026,
      month: 8,
    })
  })
})

describe("toUpcomingPlanEndings", () => {
  it("ordena los planes vigentes por mes de fin ascendente", () => {
    const endings = toUpcomingPlanEndings(
      [
        createPlan({
          planId: "largo",
          concept: "Heladera",
          totalInstallments: 24,
          knownOccurrence: {
            period: { year: 2026, month: 1 },
            installmentNumber: 1,
          },
        }),
        createPlan({ planId: "card", totalInstallments: 6 }),
      ],
      period
    )

    expect(endings.map((ending) => ending.planId)).toEqual(["card", "largo"])
    expect(endings.map((ending) => ending.endsAt)).toEqual([
      { year: 2026, month: 8 },
      { year: 2027, month: 12 },
    ])
  })

  it("mantiene el plan que termina en el mes que se está viendo", () => {
    const endings = toUpcomingPlanEndings(
      [
        createPlan({
          knownOccurrence: {
            period: { year: 2026, month: 3 },
            installmentNumber: 1,
          },
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
          knownOccurrence: {
            period: { year: 2026, month: 1 },
            installmentNumber: 1,
          },
          totalInstallments: 3,
        }),
      ],
      period
    )

    expect(endings).toEqual([])
  })

  it("deja fuera un plan detenido y uno sin ninguna ocurrencia conocida", () => {
    const endings = toUpcomingPlanEndings(
      [
        createPlan({
          planId: "stopped",
          totalInstallments: 12,
          stoppedFrom: { year: 2026, month: 4 },
        }),
        createPlan({ planId: "never-generated", knownOccurrence: null }),
      ],
      period
    )

    expect(endings).toEqual([])
  })

  it("calcula el fin aunque el plan todavía no haya generado todas sus cuotas", () => {
    const [ending] = toUpcomingPlanEndings(
      [
        createPlan({
          knownOccurrence: {
            period: { year: 2026, month: 4 },
            installmentNumber: 1,
          },
          totalInstallments: 18,
        }),
      ],
      period
    )

    expect(ending?.endsAt).toEqual({ year: 2027, month: 9 })
  })

  it("no proyecta cuotas que ya se pagaron cuando la ocurrencia cargada es la última del plan", () => {
    // El usuario puede cargar una compra empezando por la cuota 3/3: ese plan
    // ya terminó en su propio mes, no dos meses después.
    const endings = toUpcomingPlanEndings(
      [
        createPlan({
          totalInstallments: 3,
          knownOccurrence: {
            period: { year: 2026, month: 5 },
            installmentNumber: 3,
          },
        }),
      ],
      period
    )

    expect(endings.map((ending) => ending.endsAt)).toEqual([
      { year: 2026, month: 5 },
    ])
  })

  it("calcula el fin desde una cuota intermedia conocida", () => {
    const [ending] = toUpcomingPlanEndings(
      [
        createPlan({
          totalInstallments: 5,
          knownOccurrence: {
            period: { year: 2026, month: 5 },
            installmentNumber: 2,
          },
        }),
      ],
      period
    )

    expect(ending?.endsAt).toEqual({ year: 2026, month: 8 })
  })
})
