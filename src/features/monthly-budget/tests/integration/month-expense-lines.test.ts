import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fetchMonthExpenseLines } from "@/features/monthly-budget/api/monthly-budget-queries"
import type { Period } from "@/shared/lib/period"

/**
 * Each month line has to say which kind of expense it is and which row owns
 * it, because that is what a later edit or delete needs to reach the right
 * feature. Totals are covered elsewhere, so this only checks that routing
 * information.
 */
const { fromMock, scenario } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  const scenario = {
    occurrences: [] as unknown[],
    otherExpenses: [] as unknown[],
    selects: [] as string[],
  }

  const createBuilder = (table: string) => {
    const builder = {
      select: (columns: string) => {
        scenario.selects.push(columns)

        return builder
      },
      eq: () => builder,
      then: <TFulfilled = QueryResult, TRejected = never>(
        onfulfilled?:
          ((value: QueryResult) => TFulfilled | PromiseLike<TFulfilled>) | null,
        onrejected?:
          ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null
      ) =>
        Promise.resolve({
          data:
            table === "expense_occurrences"
              ? scenario.occurrences
              : scenario.otherExpenses,
          error: null,
        }).then(onfulfilled, onrejected),
    }

    return builder
  }

  return { fromMock: vi.fn((table: string) => createBuilder(table)), scenario }
})

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { from: fromMock },
}))

const VIEWED_PERIOD: Period = { year: 2026, month: 3 }

const occurrence = (id: string, planId: string, kind: string) => ({
  id,
  amount: 1000,
  installment_number: null,
  spending_plans: {
    id: planId,
    kind,
    concept: `Concepto ${id}`,
    group_label: "BBVA",
    currency: "ars",
    total_installments: null,
  },
})

describe("fetchMonthExpenseLines", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    scenario.occurrences = []
    scenario.otherExpenses = []
    scenario.selects = []
  })

  it("marca cada línea con su tipo y con el id que hace falta para editarla", async () => {
    scenario.occurrences = [
      occurrence("occurrence-1", "plan-card", "card_purchase"),
      occurrence("occurrence-2", "plan-loan", "loan"),
      occurrence("occurrence-3", "plan-recurring", "recurring"),
    ]
    scenario.otherExpenses = [
      { id: "other-1", concept: "Hosting", amount: 100, currency: "usd" },
    ]

    const lines = await fetchMonthExpenseLines(VIEWED_PERIOD)

    expect(lines.map(({ id, kind, planId }) => ({ id, kind, planId }))).toEqual(
      [
        { id: "occurrence-1", kind: "card_purchase", planId: "plan-card" },
        { id: "occurrence-2", kind: "loan", planId: "plan-loan" },
        { id: "occurrence-3", kind: "recurring", planId: "plan-recurring" },
        // An other expense has no plan, so it owns itself.
        { id: "other-1", kind: "other", planId: "other-1" },
      ]
    )
  })

  it("no inventa un plan cuando la fila no trae el tipo esperado", async () => {
    scenario.occurrences = [
      occurrence("occurrence-1", "plan-1", "something_else"),
    ]

    const [line] = await fetchMonthExpenseLines(VIEWED_PERIOD)

    expect(line?.kind).toBe("other")
    expect(line?.planId).toBe("plan-1")
  })

  it("pide a Supabase el id y el tipo del plan dueño", async () => {
    await fetchMonthExpenseLines(VIEWED_PERIOD)

    const occurrencesSelect = scenario.selects[0] ?? ""

    expect(occurrencesSelect).toContain("spending_plans(")
    expect(occurrencesSelect).toContain("id")
    expect(occurrencesSelect).toContain("kind")
  })
})
