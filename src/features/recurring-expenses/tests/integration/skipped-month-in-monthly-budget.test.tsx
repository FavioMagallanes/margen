import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fetchMonthExpenseLines } from "@/features/monthly-budget/api/monthly-budget-queries"
import { MonthExpenses } from "@/features/monthly-budget/components/month-expenses"
import type { Period } from "@/shared/lib/period"

/**
 * RF-05: un mes omitido no es un dato faltante. La diferencia con un importe
 * realmente ausente es lo que se prueba acá, porque es la que decide si el
 * disponible del mes queda incompleto.
 */
type StoredOccurrence = {
  id: string
  amount: number | null
  installment_number: number | null
  is_skipped: boolean
  spending_plans: {
    id: string
    kind: string
    concept: string
    group_label: string
    currency: string
    total_installments: number | null
  }
}

const { fromMock, scenario } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  const scenario = { occurrences: [] as { is_skipped: boolean }[] }

  const createBuilder = (table: string) => {
    const filters: Record<string, unknown> = {}

    const rows = (): unknown[] => {
      if (table !== "expense_occurrences") {
        return []
      }

      // El mock aplica el mismo filtro que la consulta real: si faltara,
      // la fila omitida llegaría al resumen del mes.
      return scenario.occurrences.filter(
        (occurrence) =>
          filters.is_skipped === undefined ||
          occurrence.is_skipped === filters.is_skipped
      )
    }

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value

        return builder
      },
      then: <TFulfilled = QueryResult, TRejected = never>(
        onfulfilled?:
          ((value: QueryResult) => TFulfilled | PromiseLike<TFulfilled>) | null,
        onrejected?:
          ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null
      ) =>
        Promise.resolve({ data: rows(), error: null }).then(
          onfulfilled,
          onrejected
        ),
    }

    return builder
  }

  return { fromMock: vi.fn((table: string) => createBuilder(table)), scenario }
})

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { from: fromMock },
}))

const VIEWED_PERIOD: Period = { year: 2026, month: 3 }

const internetPlan = {
  id: "plan-internet",
  kind: "recurring",
  concept: "Internet",
  group_label: "Otros gastos",
  currency: "ars",
  total_installments: null,
}

const paidMonth: StoredOccurrence = {
  id: "occurrence-internet",
  amount: 45_000,
  installment_number: null,
  is_skipped: false,
  spending_plans: internetPlan,
}

const skippedMonth: StoredOccurrence = {
  id: "occurrence-luz-skipped",
  amount: null,
  installment_number: null,
  is_skipped: true,
  spending_plans: {
    id: "plan-luz",
    kind: "recurring",
    concept: "Luz",
    group_label: "Otros gastos",
    currency: "ars",
    total_installments: null,
  },
}

const setOccurrences = (occurrences: StoredOccurrence[]) => {
  scenario.occurrences = occurrences
}

describe("un recurrente omitido dentro del resumen del mes", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    scenario.occurrences = []
  })

  it("no aparece como línea ni deja el total incompleto", async () => {
    setOccurrences([paidMonth, skippedMonth])

    const lines = await fetchMonthExpenseLines(VIEWED_PERIOD)

    expect(lines).toHaveLength(1)
    expect(lines[0]?.concept).toBe("Internet")
    expect(lines[0]?.kind).toBe("recurring")
    expect(lines[0]?.planId).toBe("plan-internet")

    render(
      <MonthExpenses lines={lines} arsPerUsd={null} periodLabel="Marzo 2026" />
    )

    expect(screen.queryByText("Luz")).toBeNull()
    expect(screen.queryByText("Sin dato")).toBeNull()
    expect(
      screen.queryByText("Total incompleto: faltan datos de este grupo.")
    ).toBeNull()
  })

  it("sí deja el total incompleto cuando el importe falta de verdad", async () => {
    setOccurrences([paidMonth, { ...skippedMonth, is_skipped: false }])

    const lines = await fetchMonthExpenseLines(VIEWED_PERIOD)

    expect(lines).toHaveLength(2)

    render(
      <MonthExpenses lines={lines} arsPerUsd={null} periodLabel="Marzo 2026" />
    )

    expect(screen.getByText("Sin dato")).toBeDefined()
    expect(
      screen.getByText("Total incompleto: faltan datos de este grupo.")
    ).toBeDefined()
  })
})
