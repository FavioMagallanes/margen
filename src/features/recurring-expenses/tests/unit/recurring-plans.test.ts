import { describe, expect, it } from "vitest"

import {
  isStoppedAt,
  type RecurringPlan,
  toPendingRecurringPlans,
} from "@/features/recurring-expenses/model/recurring-plans"
import type { Period } from "@/shared/lib/period"

const VIEWED_PERIOD: Period = { year: 2026, month: 3 }

const basePlan: RecurringPlan = {
  planId: "plan-1",
  concept: "Internet",
  groupLabel: "Otros gastos",
  currency: "ars",
  defaultAmount: 45_000,
  totalInstallments: null,
  stoppedFrom: null,
  occurrences: [],
}

describe("toPendingRecurringPlans", () => {
  it("ofrece un recurrente mensual que todavía no generó el mes", () => {
    const pending = toPendingRecurringPlans([basePlan], VIEWED_PERIOD)

    expect(pending).toHaveLength(1)
    expect(pending[0]?.planId).toBe("plan-1")
  })

  it("deja fuera el mes ya generado, incluso si fue omitido", () => {
    expect(
      toPendingRecurringPlans(
        [
          {
            ...basePlan,
            occurrences: [
              { year: 2026, month: 3, amount: 45_000, isSkipped: false },
            ],
          },
        ],
        VIEWED_PERIOD
      )
    ).toHaveLength(0)

    expect(
      toPendingRecurringPlans(
        [
          {
            ...basePlan,
            occurrences: [
              { year: 2026, month: 3, amount: null, isSkipped: true },
            ],
          },
        ],
        VIEWED_PERIOD
      )
    ).toHaveLength(0)
  })

  it("deja fuera un recurrente detenido desde este mes o antes", () => {
    expect(
      toPendingRecurringPlans(
        [{ ...basePlan, stoppedFrom: { year: 2026, month: 3 } }],
        VIEWED_PERIOD
      )
    ).toHaveLength(0)

    expect(
      toPendingRecurringPlans(
        [{ ...basePlan, stoppedFrom: { year: 2025, month: 12 } }],
        VIEWED_PERIOD
      )
    ).toHaveLength(0)
  })

  it("sigue ofreciendo un recurrente que se detiene recién el mes que viene", () => {
    expect(
      toPendingRecurringPlans(
        [{ ...basePlan, stoppedFrom: { year: 2026, month: 4 } }],
        VIEWED_PERIOD
      )
    ).toHaveLength(1)
  })

  it("deja fuera un plan finito que ya generó todos sus meses", () => {
    const finishedPlan: RecurringPlan = {
      ...basePlan,
      totalInstallments: 2,
      occurrences: [
        { year: 2026, month: 1, amount: 45_000, isSkipped: false },
        { year: 2026, month: 2, amount: 45_000, isSkipped: false },
      ],
    }

    expect(toPendingRecurringPlans([finishedPlan], VIEWED_PERIOD)).toHaveLength(
      0
    )
    expect(
      toPendingRecurringPlans(
        [{ ...finishedPlan, totalInstallments: 3 }],
        VIEWED_PERIOD
      )
    ).toHaveLength(1)
  })

  it("estima el importe variable con el último importe real cargado", () => {
    const pending = toPendingRecurringPlans(
      [
        {
          ...basePlan,
          defaultAmount: null,
          occurrences: [
            { year: 2026, month: 2, amount: 52_000, isSkipped: false },
            { year: 2025, month: 12, amount: 40_000, isSkipped: false },
            { year: 2026, month: 1, amount: null, isSkipped: true },
          ],
        },
      ],
      VIEWED_PERIOD
    )

    expect(pending[0]?.lastKnownAmount).toBe(52_000)
  })

  it("no estima nada cuando el recurrente variable nunca tuvo un importe", () => {
    const pending = toPendingRecurringPlans(
      [
        {
          ...basePlan,
          defaultAmount: null,
          occurrences: [
            { year: 2026, month: 2, amount: null, isSkipped: true },
          ],
        },
      ],
      VIEWED_PERIOD
    )

    expect(pending[0]?.lastKnownAmount).toBeNull()
  })
})

describe("isStoppedAt", () => {
  it("solo considera detenido el mes de corte en adelante", () => {
    expect(isStoppedAt(null, VIEWED_PERIOD)).toBe(false)
    expect(isStoppedAt({ year: 2026, month: 4 }, VIEWED_PERIOD)).toBe(false)
    expect(isStoppedAt({ year: 2026, month: 3 }, VIEWED_PERIOD)).toBe(true)
    expect(isStoppedAt({ year: 2026, month: 2 }, VIEWED_PERIOD)).toBe(true)
  })
})
