import { MemoryRouter, Route, Routes } from "react-router"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { createFakeSession } from "@/features/auth/tests/fixtures/session"
import { UpcomingExpensesPage } from "@/features/upcoming-expenses/components/upcoming-expenses-page"

type PlanRow = {
  id: string
  concept: string
  group_label: string
  currency: string
  kind: string
  default_amount: number | null
  total_installments: number | null
  stopped_from_year: number | null
  stopped_from_month: number | null
  expense_occurrences: {
    year: number
    month: number
    amount: number | null
    is_skipped: boolean
  }[]
}

const { authMock, fromMock, scenario } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  const scenario = {
    occurrences: [] as unknown[],
    plans: [] as unknown[],
    budget: null as unknown,
    failingTable: null as string | null,
  }

  const matchesFilters = (
    row: Record<string, unknown>,
    filters: Record<string, unknown>
  ): boolean =>
    Object.entries(filters).every(([column, value]) => {
      // The kind filter of the recurring query lives on the embedded plan.
      if (column === "spending_plans.kind") {
        return (
          (row.spending_plans as { kind?: string } | undefined)?.kind === value
        )
      }

      return row[column] === value
    })

  const createBuilder = (table: string) => {
    const filters: Record<string, unknown> = {}
    let onlyFinitePlans = false

    const result = (): QueryResult => {
      if (scenario.failingTable === table) {
        return { data: null, error: { message: "database exploded" } }
      }

      if (table === "monthly_budgets") {
        return { data: scenario.budget, error: null }
      }

      const rows =
        table === "expense_occurrences" ? scenario.occurrences : scenario.plans

      const visible = rows
        .filter((row) =>
          matchesFilters(row as Record<string, unknown>, filters)
        )
        .filter(
          (row) =>
            !onlyFinitePlans ||
            (row as { total_installments: number | null })
              .total_installments !== null
        )

      return { data: visible, error: null }
    }

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value

        return builder
      },
      not: () => {
        onlyFinitePlans = true

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
    scenario,
  }
})

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { auth: authMock, from: fromMock },
}))

const createPlan = (plan: Partial<PlanRow>): PlanRow => ({
  id: "plan-1",
  concept: "Luz",
  group_label: "Servicios",
  currency: "ars",
  kind: "recurring",
  default_amount: null,
  total_installments: null,
  stopped_from_year: null,
  stopped_from_month: null,
  expense_occurrences: [],
  ...plan,
})

const renderUpcomingPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/months/2026/5/upcoming"]}>
          <Routes>
            <Route
              path="/months/:year/:month/upcoming"
              element={<UpcomingExpensesPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe("UpcomingExpensesPage", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    scenario.occurrences = []
    scenario.plans = []
    scenario.budget = null
    scenario.failingTable = null

    authMock.getSession.mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    })
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it("suma las líneas ya generadas del mes y las muestra con su tipo", async () => {
    scenario.budget = { salary_ars: 1_000_000, exchange_rate_value: 1600 }
    scenario.occurrences = [
      {
        id: "occurrence-1",
        amount: 45_000,
        amount_is_estimated: false,
        installment_number: 3,
        year: 2026,
        month: 5,
        is_skipped: false,
        spending_plans: {
          concept: "Notebook",
          group_label: "Visa",
          currency: "ars",
          total_installments: 6,
          kind: "card_purchase",
        },
      },
      {
        id: "occurrence-2",
        amount: 100,
        amount_is_estimated: false,
        installment_number: 2,
        year: 2026,
        month: 5,
        is_skipped: false,
        spending_plans: {
          concept: "Curso",
          group_label: "Amex",
          currency: "usd",
          total_installments: 3,
          kind: "card_purchase",
        },
      },
    ]

    renderUpcomingPage()

    const notebookRow = await screen.findByRole("row", { name: /Notebook/ })
    expect(within(notebookRow).getByText("Tarjeta")).toBeDefined()
    expect(within(notebookRow).getByText("3/6")).toBeDefined()

    // 45.000 ARS + 100 USD a 1.600 = 205.000 ARS.
    expect(screen.getByText("$ 205.000,00")).toBeDefined()
    // El disponible parte del sueldo cargado del mes.
    expect(screen.getByText("$ 795.000,00")).toBeDefined()
    expect(
      screen.getByText(
        "Las líneas en USD se convierten con la cotización guardada del mes como referencia presupuestaria, no como el importe que va a cobrar el banco."
      )
    ).toBeDefined()
  })

  it("proyecta el recurrente activo que todavía no generó el mes", async () => {
    scenario.plans = [
      createPlan({ id: "fixed", default_amount: 30_000 }),
      createPlan({
        id: "variable",
        concept: "Gas",
        expense_occurrences: [
          { year: 2026, month: 4, amount: 12_500, is_skipped: false },
        ],
      }),
      createPlan({ id: "sin-historial", concept: "Agua" }),
    ]

    renderUpcomingPage()

    const fixedRow = await screen.findByRole("row", { name: /Luz/ })
    expect(within(fixedRow).getByText("Proyectado")).toBeDefined()
    expect(within(fixedRow).getByText("$ 30.000,00")).toBeDefined()
    expect(within(fixedRow).queryByText("Estimado")).toBeNull()

    const variableRow = screen.getByRole("row", { name: /Gas/ })
    expect(within(variableRow).getByText("Estimado")).toBeDefined()
    expect(within(variableRow).getByText("$ 12.500,00")).toBeDefined()

    const missingRow = screen.getByRole("row", { name: /Agua/ })
    expect(within(missingRow).getByText("Sin dato")).toBeDefined()

    // Un importe faltante nunca se lee como cero: el total queda avisado.
    expect(
      screen.getByText(
        "El total está incompleto: falta algún importe o la cotización del mes, así que esto no es definitivo."
      )
    ).toBeDefined()
  })

  it("no proyecta un recurrente detenido, agotado o ya generado para el mes", async () => {
    scenario.occurrences = [
      {
        id: "occurrence-generado",
        amount: 9_000,
        amount_is_estimated: false,
        installment_number: null,
        year: 2026,
        month: 5,
        is_skipped: false,
        spending_plans: {
          concept: "Internet",
          group_label: "Servicios",
          currency: "ars",
          total_installments: null,
          kind: "recurring",
        },
      },
    ]
    scenario.plans = [
      createPlan({
        id: "detenido",
        concept: "Gimnasio",
        default_amount: 20_000,
        stopped_from_year: 2026,
        stopped_from_month: 4,
      }),
      createPlan({
        id: "agotado",
        concept: "Seguro",
        default_amount: 15_000,
        total_installments: 2,
        expense_occurrences: [
          { year: 2026, month: 3, amount: 15_000, is_skipped: false },
          { year: 2026, month: 4, amount: 15_000, is_skipped: false },
        ],
      }),
      createPlan({
        id: "ya-generado",
        concept: "Internet",
        default_amount: 9_000,
        expense_occurrences: [
          { year: 2026, month: 5, amount: 9_000, is_skipped: false },
        ],
      }),
    ]

    renderUpcomingPage()

    const internetRow = await screen.findByRole("row", { name: /Internet/ })
    expect(screen.queryByText("Gimnasio")).toBeNull()
    expect(screen.queryByText("Seguro")).toBeNull()
    expect(screen.queryByText("Proyectado")).toBeNull()
    expect(within(internetRow).getByText("$ 9.000,00")).toBeDefined()
  })

  it("muestra lo comprometido aunque el mes no tenga sueldo cargado", async () => {
    scenario.plans = [createPlan({ default_amount: 30_000 })]

    renderUpcomingPage()

    expect(
      await screen.findByText(
        "Cargá el sueldo de Mayo de 2026 para ver el disponible."
      )
    ).toBeDefined()
    const luzRow = screen.getByRole("row", { name: /Luz/ })
    expect(within(luzRow).getByText("$ 30.000,00")).toBeDefined()
  })

  it("lista los planes en curso ordenados por su mes de fin", async () => {
    scenario.plans = [
      createPlan({
        id: "prestamo",
        concept: "Préstamo auto",
        group_label: "Banco Nación",
        kind: "loan",
        total_installments: 24,
        expense_occurrences: [
          { year: 2026, month: 1, amount: 80_000, is_skipped: false },
        ],
      }),
      createPlan({
        id: "tarjeta",
        concept: "Notebook",
        group_label: "Visa",
        kind: "card_purchase",
        total_installments: 6,
        expense_occurrences: [
          { year: 2026, month: 3, amount: 45_000, is_skipped: false },
        ],
      }),
      createPlan({
        id: "terminado",
        concept: "Heladera",
        group_label: "Visa",
        kind: "card_purchase",
        total_installments: 3,
        expense_occurrences: [
          { year: 2026, month: 1, amount: 20_000, is_skipped: false },
        ],
      }),
    ]

    renderUpcomingPage()

    const endingsTable = await screen.findByRole("table", {
      name: "Planes de cuotas y su mes de fin",
    })
    const rows = within(endingsTable).getAllByRole("row").slice(1)

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Agosto de 2026"),
      expect.stringContaining("Diciembre de 2027"),
    ])
    expect(rows[0]?.textContent).toContain("Notebook")
    expect(within(endingsTable).queryByText("Heladera")).toBeNull()
  })
})
