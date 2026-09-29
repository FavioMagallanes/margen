import { MemoryRouter, Route, Routes } from "react-router"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { createFakeSession } from "@/features/auth/tests/fixtures/session"
import { UpcomingExpensesPage } from "@/features/upcoming-expenses/components/upcoming-expenses-page"

type PlanOccurrenceRow = {
  year: number
  month: number
  installment_number: number | null
}

type PlanRow = {
  id: string
  concept: string
  group_label: string
  currency: string
  kind: string
  total_installments: number | null
  stopped_from_year: number | null
  stopped_from_month: number | null
  expense_occurrences: PlanOccurrenceRow[]
}

const { authMock, fromMock, scenario } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  const scenario = {
    occurrences: [] as unknown[],
    plans: [] as unknown[],
    budget: null as unknown,
    failingTable: null as string | null,
  }

  const readColumn = (
    row: Record<string, unknown>,
    column: string
  ): unknown => {
    // The kind filter of the occurrences query lives on the embedded plan.
    if (column === "spending_plans.kind") {
      return (row.spending_plans as { kind?: string } | undefined)?.kind
    }

    return row[column]
  }

  const createBuilder = (table: string) => {
    const equals: Record<string, unknown> = {}
    const greaterThan: Record<string, number> = {}

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
          Object.entries(equals).every(
            ([column, value]) =>
              readColumn(row as Record<string, unknown>, column) === value
          )
        )
        .filter((row) =>
          Object.entries(greaterThan).every(([column, value]) => {
            const actual = readColumn(row as Record<string, unknown>, column)

            return typeof actual === "number" && actual > value
          })
        )

      return { data: visible, error: null }
    }

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        equals[column] = value

        return builder
      },
      gt: (column: string, value: number) => {
        greaterThan[column] = value

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
  concept: "Notebook",
  group_label: "Visa",
  currency: "ars",
  kind: "card_purchase",
  total_installments: 6,
  stopped_from_year: null,
  stopped_from_month: null,
  expense_occurrences: [],
  ...plan,
})

const createOccurrence = (occurrence: {
  id: string
  amount?: number | null
  amountIsEstimated?: boolean
  installmentNumber?: number | null
  concept: string
  groupLabel?: string
  currency?: string
  totalInstallments?: number | null
  kind?: string
}) => ({
  id: occurrence.id,
  amount: occurrence.amount ?? null,
  amount_is_estimated: occurrence.amountIsEstimated ?? false,
  installment_number: occurrence.installmentNumber ?? null,
  year: 2026,
  month: 5,
  is_skipped: false,
  spending_plans: {
    concept: occurrence.concept,
    group_label: occurrence.groupLabel ?? "Visa",
    currency: occurrence.currency ?? "ars",
    total_installments: occurrence.totalInstallments ?? null,
    kind: occurrence.kind ?? "card_purchase",
  },
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
      data: { subscription: { subscribe: vi.fn(), unsubscribe: vi.fn() } },
    })
  })

  it("suma las cuotas de tarjeta del mes y las muestra con su número de cuota", async () => {
    scenario.budget = { salary_ars: 1_000_000, exchange_rate_value: 1600 }
    scenario.occurrences = [
      createOccurrence({
        id: "occurrence-1",
        concept: "Notebook",
        amount: 45_000,
        installmentNumber: 3,
        totalInstallments: 6,
      }),
      createOccurrence({
        id: "occurrence-2",
        concept: "Curso",
        groupLabel: "Amex",
        currency: "usd",
        amount: 100,
        installmentNumber: 2,
        totalInstallments: 3,
      }),
    ]

    renderUpcomingPage()

    const notebookRow = await screen.findByRole("row", { name: /Notebook/ })
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

  it("deja fuera del mes los préstamos y los recurrentes", async () => {
    scenario.occurrences = [
      createOccurrence({
        id: "tarjeta",
        concept: "Notebook",
        amount: 45_000,
        installmentNumber: 1,
        totalInstallments: 6,
      }),
      createOccurrence({
        id: "prestamo",
        concept: "Préstamo auto",
        kind: "loan",
        amount: 80_000,
        installmentNumber: 4,
        totalInstallments: 24,
      }),
      createOccurrence({
        id: "recurrente",
        concept: "Internet",
        kind: "recurring",
        amount: 9_000,
      }),
    ]

    renderUpcomingPage()

    const notebookRow = await screen.findByRole("row", { name: /Notebook/ })
    expect(screen.queryByText("Préstamo auto")).toBeNull()
    expect(screen.queryByText("Internet")).toBeNull()
    expect(within(notebookRow).getByText("$ 45.000,00")).toBeDefined()
  })

  it("avisa que el total está incompleto cuando falta un importe, sin leerlo como cero", async () => {
    scenario.occurrences = [
      createOccurrence({
        id: "sin-importe",
        concept: "Heladera",
        amount: null,
        installmentNumber: 1,
        totalInstallments: 3,
      }),
    ]

    renderUpcomingPage()

    const row = await screen.findByRole("row", { name: /Heladera/ })
    expect(within(row).getByText("Sin dato")).toBeDefined()
    expect(
      screen.getByText(
        "El total está incompleto: falta algún importe o la cotización del mes, así que esto no es definitivo."
      )
    ).toBeDefined()
  })

  it("muestra lo comprometido aunque el mes no tenga sueldo cargado", async () => {
    scenario.occurrences = [
      createOccurrence({
        id: "occurrence-1",
        concept: "Notebook",
        amount: 30_000,
        installmentNumber: 1,
        totalInstallments: 6,
      }),
    ]

    renderUpcomingPage()

    expect(
      await screen.findByText(
        "Cargá el sueldo de Mayo de 2026 para ver el disponible."
      )
    ).toBeDefined()
    const notebookRow = screen.getByRole("row", { name: /Notebook/ })
    expect(within(notebookRow).getByText("$ 30.000,00")).toBeDefined()
  })

  it("lista los planes de tarjeta en curso ordenados por su mes de fin", async () => {
    scenario.plans = [
      createPlan({
        id: "largo",
        concept: "Heladera",
        total_installments: 24,
        expense_occurrences: [{ year: 2026, month: 1, installment_number: 1 }],
      }),
      createPlan({
        id: "tarjeta",
        concept: "Notebook",
        total_installments: 6,
        expense_occurrences: [{ year: 2026, month: 3, installment_number: 1 }],
      }),
      createPlan({
        id: "terminado",
        concept: "Lavarropas",
        total_installments: 3,
        expense_occurrences: [{ year: 2026, month: 1, installment_number: 1 }],
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
    expect(within(endingsTable).queryByText("Lavarropas")).toBeNull()
  })

  it("termina el plan en el mes de su última cuota aunque sea la única cargada", async () => {
    scenario.plans = [
      createPlan({
        id: "cuota-final",
        concept: "Notebook",
        total_installments: 3,
        expense_occurrences: [{ year: 2026, month: 5, installment_number: 3 }],
      }),
    ]

    renderUpcomingPage()

    const endingsTable = await screen.findByRole("table", {
      name: "Planes de cuotas y su mes de fin",
    })
    const [row] = within(endingsTable).getAllByRole("row").slice(1)

    expect(row?.textContent).toContain("Mayo de 2026")
  })

  it("no lista entre los planes que terminan una compra de una sola cuota ni los planes de otro tipo", async () => {
    scenario.occurrences = [
      createOccurrence({
        id: "pago-unico",
        concept: "Zapatillas",
        amount: 60_000,
        installmentNumber: 1,
        totalInstallments: 1,
      }),
    ]
    scenario.plans = [
      createPlan({
        id: "pago-unico",
        concept: "Zapatillas",
        total_installments: 1,
        expense_occurrences: [{ year: 2026, month: 5, installment_number: 1 }],
      }),
      createPlan({
        id: "prestamo",
        concept: "Préstamo auto",
        kind: "loan",
        total_installments: 24,
        expense_occurrences: [{ year: 2026, month: 1, installment_number: 1 }],
      }),
    ]

    renderUpcomingPage()

    // El pago único sigue comprometiendo el mes, pero no es un plan en curso.
    expect(await screen.findByText("Zapatillas")).toBeDefined()
    expect(
      screen.getByText(
        "No hay planes de cuotas en curso que terminen desde este mes en adelante."
      )
    ).toBeDefined()
    expect(screen.queryByText("Préstamo auto")).toBeNull()
  })

  it("avisa cuando el mes no tiene ninguna cuota comprometida", async () => {
    renderUpcomingPage()

    expect(
      await screen.findByText(
        "Este mes no tiene ninguna cuota de tarjeta comprometida."
      )
    ).toBeDefined()
  })

  it("muestra un error recuperable cuando la lectura falla", async () => {
    scenario.failingTable = "expense_occurrences"

    renderUpcomingPage()

    expect(
      await screen.findByText(
        "No pudimos cargar lo comprometido de este mes. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
  })
})
