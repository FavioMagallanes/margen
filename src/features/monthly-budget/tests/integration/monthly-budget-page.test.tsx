import { MemoryRouter, Route, Routes } from "react-router"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { createFakeSession } from "@/features/auth/tests/fixtures/session"
import { MonthlyBudgetPage } from "@/features/monthly-budget/monthly-budget-page"

type BudgetRow = {
  salary_ars: number | null
  exchange_rate_value: number | null
}

const { authMock, fromMock, upsertMock, scenario } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  type StoredBudget = {
    salary_ars: number | null
    exchange_rate_value: number | null
  }

  type UpsertPayload = {
    user_id: string
    year: number
    month: number
    salary_ars: number
  }

  const scenario = {
    budgets: new Map<string, StoredBudget>(),
    expenseOccurrences: [] as unknown[],
    otherExpenses: [] as unknown[],
    failingTable: null as string | null,
    upsertError: null as { message: string } | null,
  }

  const budgetKey = (year: unknown, month: unknown) => `${year}-${month}`

  const upsertMock = vi.fn()

  const isUpsertPayload = (payload: unknown): payload is UpsertPayload => {
    if (typeof payload !== "object" || payload === null) {
      return false
    }

    const candidate = payload as Record<string, unknown>

    return (
      typeof candidate.year === "number" &&
      typeof candidate.month === "number" &&
      typeof candidate.salary_ars === "number"
    )
  }

  const resolveResult = (
    table: string,
    filters: Record<string, unknown>,
    isUpsert: boolean
  ): QueryResult => {
    if (scenario.failingTable === table) {
      return { data: null, error: { message: "database exploded" } }
    }

    if (isUpsert) {
      return { data: null, error: scenario.upsertError }
    }

    if (table === "monthly_budgets") {
      const stored = scenario.budgets.get(
        budgetKey(filters.year, filters.month)
      )

      return { data: stored ?? null, error: null }
    }

    if (table === "expense_occurrences") {
      return { data: scenario.expenseOccurrences, error: null }
    }

    return { data: scenario.otherExpenses, error: null }
  }

  const createBuilder = (table: string) => {
    const filters: Record<string, unknown> = {}
    let isUpsert = false

    const result = () => resolveResult(table, filters, isUpsert)

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value

        return builder
      },
      upsert: (payload: unknown, options: unknown) => {
        isUpsert = true
        upsertMock(table, payload, options)

        if (scenario.upsertError === null && isUpsertPayload(payload)) {
          scenario.budgets.set(budgetKey(payload.year, payload.month), {
            salary_ars: payload.salary_ars,
            exchange_rate_value: null,
          })
        }

        return builder
      },
      maybeSingle: () => Promise.resolve(result()),
      then: <TFulfilled = QueryResult, TRejected = never>(
        onfulfilled?:
          ((value: QueryResult) => TFulfilled | PromiseLike<TFulfilled>) | null,
        onrejected?:
          ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null
      ) => Promise.resolve(result()).then(onfulfilled, onrejected),
    }

    return builder
  }

  return {
    authMock: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    fromMock: vi.fn((table: string) => createBuilder(table)),
    upsertMock,
    scenario,
  }
})

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { auth: authMock, from: fromMock },
}))

const setBudget = (year: number, month: number, row: BudgetRow) => {
  scenario.budgets.set(`${year}-${month}`, row)
}

const renderBudgetPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/months/2026/3"]}>
          <Routes>
            <Route
              path="/months/:year/:month"
              element={<MonthlyBudgetPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe("MonthlyBudgetPage", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    scenario.budgets.clear()
    scenario.expenseOccurrences = []
    scenario.otherExpenses = []
    scenario.failingTable = null
    scenario.upsertError = null

    authMock.getSession.mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    })
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it("muestra «Sin presupuesto definido» y ningún disponible cuando no hay sueldo", async () => {
    renderBudgetPage()

    expect(await screen.findByText("Sin presupuesto definido")).toBeDefined()
    expect(
      screen.getByText("Cargá el sueldo del mes para ver el disponible.")
    ).toBeDefined()
    expect(
      screen.getByText("Todavía no cargaste gastos para este mes.")
    ).toBeDefined()
  })

  it("muestra el disponible calculado cuando el sueldo está cargado", async () => {
    setBudget(2026, 3, { salary_ars: 1_850_000, exchange_rate_value: 1640 })
    scenario.expenseOccurrences = [
      {
        id: "occurrence-1",
        amount: 45_000,
        installment_number: 3,
        spending_plans: {
          concept: "Notebook",
          group_label: "BBVA",
          currency: "ars",
          total_installments: 6,
        },
      },
    ]
    scenario.otherExpenses = [
      { id: "other-1", concept: "Hosting", amount: 100, currency: "usd" },
    ]

    renderBudgetPage()

    // 45.000 + (100 * 1640) = 209.000 de gastos conocidos.
    expect(await screen.findByText(/1\.641\.000,00/)).toBeDefined()
    expect(screen.queryByText("Sin presupuesto definido")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Copiar sueldo del mes anterior" })
    ).toBeNull()
  })

  it("no muestra el botón de copiar cuando el mes anterior tampoco tiene sueldo", async () => {
    renderBudgetPage()

    expect(await screen.findByText("Sin presupuesto definido")).toBeDefined()
    expect(
      screen.queryByRole("button", { name: "Copiar sueldo del mes anterior" })
    ).toBeNull()
  })

  it("copia el sueldo del mes anterior solo cuando el usuario lo pide", async () => {
    setBudget(2026, 2, { salary_ars: 1_200_000, exchange_rate_value: null })

    renderBudgetPage()

    const copyButton = await screen.findByRole("button", {
      name: "Copiar sueldo del mes anterior",
    })

    expect(upsertMock).not.toHaveBeenCalled()

    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        "monthly_budgets",
        {
          user_id: "00000000-0000-0000-0000-000000000001",
          year: 2026,
          month: 3,
          salary_ars: 1_200_000,
        },
        { onConflict: "user_id,year,month" }
      )
    })

    expect(
      (await screen.findAllByText(/1\.200\.000,00/)).length
    ).toBeGreaterThan(0)
  })

  it("guarda el sueldo editado del mes", async () => {
    setBudget(2026, 3, { salary_ars: 1_000_000, exchange_rate_value: null })

    renderBudgetPage()

    const salaryField = await screen.findByLabelText("Sueldo del mes")
    fireEvent.change(salaryField, { target: { value: "1500000,50" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar sueldo" }))

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(
        "monthly_budgets",
        {
          user_id: "00000000-0000-0000-0000-000000000001",
          year: 2026,
          month: 3,
          salary_ars: 1_500_000.5,
        },
        { onConflict: "user_id,year,month" }
      )
    })
  })

  it("muestra un error genérico sin filtrar el detalle de Supabase", async () => {
    scenario.failingTable = "monthly_budgets"

    renderBudgetPage()

    expect(
      await screen.findByText(
        "No pudimos cargar el presupuesto del mes. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
    expect(screen.queryByText(/database exploded/)).toBeNull()
  })
})
