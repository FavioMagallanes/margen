import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { fetchMonthExpenseLines } from "@/features/monthly-budget/api/monthly-budget-queries"
import { MonthExpenses } from "@/features/monthly-budget/components/month-expenses"
import type { Period } from "@/shared/lib/period"

/**
 * RF-04 / RF-06: an "other expense" is one more line of the month summary, so
 * this only checks that a USD one reaches the very same calculation instead of
 * repeating the exchange rate cases already covered by monthly-budget.
 */
const { fromMock, authMock } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  const rowsByTable: Record<string, unknown[]> = {
    expense_occurrences: [],
    other_expenses: [
      {
        id: "expense-1",
        concept: "Hosting",
        amount: 120,
        currency: "usd",
      },
    ],
  }

  const createBuilder = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      then: <TFulfilled = QueryResult, TRejected = never>(
        onfulfilled?:
          ((value: QueryResult) => TFulfilled | PromiseLike<TFulfilled>) | null,
        onrejected?:
          ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null
      ) =>
        Promise.resolve({
          data: rowsByTable[table] ?? [],
          error: null,
        }).then(onfulfilled, onrejected),
    }

    return builder
  }

  return {
    fromMock: vi.fn((table: string) => createBuilder(table)),
    authMock: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: () => undefined } },
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  }
})

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { from: fromMock, auth: authMock },
}))

const VIEWED_PERIOD: Period = { year: 2026, month: 3 }

describe("otros gastos dentro del resumen del mes", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  it("muestra «Sin dato» cuando el gasto está en USD y el mes no tiene cotización", async () => {
    const lines = await fetchMonthExpenseLines(VIEWED_PERIOD)

    expect(lines).toHaveLength(1)
    expect(lines[0]?.group).toBe("Otros gastos")

    // The row also offers its actions, which need the session and the query
    // client the budget page provides.
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <MonthExpenses
            lines={lines}
            arsPerUsd={null}
            period={VIEWED_PERIOD}
            periodLabel="Marzo 2026"
          />
        </AuthProvider>
      </QueryClientProvider>
    )

    const row = within(screen.getByRole("row", { name: /Hosting/ }))

    expect(row.getByText("Sin dato")).toBeDefined()
    expect(
      screen.getByText("Total incompleto: faltan datos de este grupo.")
    ).toBeDefined()
  })
})
