import { MemoryRouter, Route, Routes } from "react-router"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { createFakeSession } from "@/features/auth/tests/fixtures/session"
import { MonthlyBudgetPage } from "@/features/monthly-budget/monthly-budget-page"

type BudgetRow = {
  salary_ars: number | null
  exchange_rate_value: number | null
  exchange_rate_source?: string | null
  exchange_rate_fetched_at?: string | null
  exchange_rate_source_updated_at?: string | null
}

const { authMock, fromMock, upsertMock, scenario } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  type StoredBudget = {
    salary_ars: number | null
    exchange_rate_value: number | null
    exchange_rate_source: string | null
    exchange_rate_fetched_at: string | null
    exchange_rate_source_updated_at: string | null
  }

  type UpsertPayload = {
    user_id: string
    year: number
    month: number
    salary_ars?: number
    exchange_rate_value?: number
    exchange_rate_source?: string
    exchange_rate_fetched_at?: string
    exchange_rate_source_updated_at?: string | null
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

  const isOptionalType = (
    value: unknown,
    expected: "number" | "string"
  ): boolean => value === undefined || typeof value === expected

  const isUpsertPayload = (payload: unknown): payload is UpsertPayload => {
    if (typeof payload !== "object" || payload === null) {
      return false
    }

    const candidate = payload as Record<string, unknown>

    return (
      typeof candidate.year === "number" &&
      typeof candidate.month === "number" &&
      isOptionalType(candidate.salary_ars, "number") &&
      isOptionalType(candidate.exchange_rate_value, "number") &&
      isOptionalType(candidate.exchange_rate_source, "string") &&
      isOptionalType(candidate.exchange_rate_fetched_at, "string")
    )
  }

  /**
   * Postgres only updates the columns the upsert payload carries, so the mock
   * merges instead of replacing: that is what keeps a saved salary alive when
   * only the exchange rate is written.
   */
  const mergeStoredBudget = (payload: UpsertPayload) => {
    const stored = scenario.budgets.get(budgetKey(payload.year, payload.month))

    scenario.budgets.set(budgetKey(payload.year, payload.month), {
      salary_ars: payload.salary_ars ?? stored?.salary_ars ?? null,
      exchange_rate_value:
        payload.exchange_rate_value ?? stored?.exchange_rate_value ?? null,
      exchange_rate_source:
        payload.exchange_rate_source ?? stored?.exchange_rate_source ?? null,
      exchange_rate_fetched_at:
        payload.exchange_rate_fetched_at ??
        stored?.exchange_rate_fetched_at ??
        null,
      exchange_rate_source_updated_at:
        "exchange_rate_source_updated_at" in payload
          ? (payload.exchange_rate_source_updated_at ?? null)
          : (stored?.exchange_rate_source_updated_at ?? null),
    })
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
          mergeStoredBudget(payload)
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
  scenario.budgets.set(`${year}-${month}`, {
    salary_ars: row.salary_ars,
    exchange_rate_value: row.exchange_rate_value,
    exchange_rate_source: row.exchange_rate_source ?? null,
    exchange_rate_fetched_at: row.exchange_rate_fetched_at ?? null,
    exchange_rate_source_updated_at:
      row.exchange_rate_source_updated_at ?? null,
  })
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

  it("muestra el formulario de sueldo y ningún disponible cuando no hay sueldo", async () => {
    renderBudgetPage()

    expect(await screen.findByLabelText("Sueldo del mes")).toBeDefined()
    expect(screen.queryByText("Sin presupuesto definido")).toBeNull()
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
          id: "plan-notebook",
          kind: "card_purchase",
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

  it("solo muestra el equivalente en ARS para las líneas en USD", async () => {
    setBudget(2026, 3, { salary_ars: 1_850_000, exchange_rate_value: 1640 })
    scenario.expenseOccurrences = [
      {
        id: "occurrence-1",
        amount: 45_000,
        installment_number: 3,
        spending_plans: {
          id: "plan-notebook",
          kind: "card_purchase",
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

    const notebookRow = (await screen.findByText("Notebook")).closest("tr")
    const hostingRow = screen.getByText("Hosting").closest("tr")

    // An ARS line already is ARS: its own amount repeated as an "equivalent"
    // is meaningless, so that cell shows a dash instead of duplicating it.
    expect(notebookRow?.textContent).toContain("—")
    expect(notebookRow?.textContent?.match(/45\.000,00/g)?.length).toBe(1)

    // A USD line does get a converted ARS equivalent (100 * 1640).
    expect(hostingRow?.textContent).toContain("164.000,00")
  })

  it("deja fuera del total la cuota de préstamo sin importe y avisa que el cálculo está incompleto", async () => {
    setBudget(2026, 3, { salary_ars: 1_000_000, exchange_rate_value: null })
    scenario.expenseOccurrences = [
      {
        id: "occurrence-1",
        amount: 120_000,
        installment_number: 4,
        spending_plans: {
          id: "plan-prestamo-personal",
          kind: "loan",
          concept: "Préstamo personal",
          group_label: "BBVA",
          currency: "ars",
          total_installments: 12,
        },
      },
      {
        // RF-03: an installment with no amount yet is not a zero expense.
        id: "occurrence-2",
        amount: null,
        installment_number: 3,
        spending_plans: {
          id: "plan-prestamo-auto",
          kind: "loan",
          concept: "Préstamo del auto",
          group_label: "Mercado Pago",
          currency: "ars",
          total_installments: 24,
        },
      },
    ]

    renderBudgetPage()

    // 1.000.000 - 120.000: the installment without amount is left out instead
    // of being added as zero.
    expect(await screen.findByText(/880\.000,00/)).toBeDefined()
    expect(
      screen.getByText(
        "El cálculo está incompleto: falta algún importe o la cotización del mes, así que este disponible no es definitivo."
      )
    ).toBeDefined()
    expect(screen.getAllByText("Sin dato").length).toBeGreaterThan(0)
  })

  it("no muestra el botón de copiar cuando el mes anterior tampoco tiene sueldo", async () => {
    renderBudgetPage()

    expect(await screen.findByLabelText("Sueldo del mes")).toBeDefined()
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

  it("al cancelar la edición del sueldo, vuelve a mostrar el valor guardado", async () => {
    setBudget(2026, 3, { salary_ars: 1_000_000, exchange_rate_value: null })

    renderBudgetPage()

    fireEvent.click(
      await screen.findByRole("button", { name: /1\.000\.000,00/ })
    )

    const salaryField = await screen.findByLabelText("Sueldo del mes")
    fireEvent.change(salaryField, { target: { value: "9999" } })
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(screen.queryByLabelText("Sueldo del mes")).toBeNull()
    expect(
      await screen.findByRole("button", { name: /1\.000\.000,00/ })
    ).toBeDefined()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("guarda el sueldo editado del mes", async () => {
    setBudget(2026, 3, { salary_ars: 1_000_000, exchange_rate_value: null })

    renderBudgetPage()

    // The salary is already saved, so it starts as a clickable read-only
    // value; clicking it is what reveals the input again.
    fireEvent.click(
      await screen.findByRole("button", { name: /1\.000\.000,00/ })
    )

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

  describe("cotización del mes", () => {
    const usdExpense = {
      id: "other-1",
      concept: "Hosting",
      amount: 100,
      currency: "usd",
    }

    const stubFetch = (
      result: { venta: number; fechaActualizacion: string } | Error
    ) => {
      const fetchMock = vi.fn(() =>
        result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(result),
            })
      )

      vi.stubGlobal("fetch", fetchMock)

      return fetchMock
    }

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it("aplica la cotización consultada recién después de confirmar", async () => {
      setBudget(2026, 3, {
        salary_ars: 1_000_000,
        exchange_rate_value: 1640,
        exchange_rate_source: "api",
        exchange_rate_fetched_at: "2026-03-01T12:00:00.000Z",
        exchange_rate_source_updated_at: "2026-03-01T11:00:00.000Z",
      })
      scenario.otherExpenses = [usdExpense]
      stubFetch({
        venta: 2008.5,
        fechaActualizacion: "2026-03-10T18:55:00.000Z",
      })

      renderBudgetPage()

      fireEvent.click(
        await screen.findByRole("button", { name: "Actualizar cotización" })
      )

      expect(await screen.findByText("¿Aplicar esta cotización?")).toBeDefined()
      // La vista previa compara el gasto conocido antes y después: 100 USD.
      expect(screen.getByText(/2\.008,50 por USD/)).toBeDefined()
      expect(screen.getByText(/164\.000,00.+200\.850,00/)).toBeDefined()
      expect(upsertMock).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledWith(
          "monthly_budgets",
          expect.objectContaining({
            user_id: "00000000-0000-0000-0000-000000000001",
            year: 2026,
            month: 3,
            exchange_rate_value: 2008.5,
            exchange_rate_source: "api",
            exchange_rate_source_updated_at: "2026-03-10T18:55:00.000Z",
          }),
          { onConflict: "user_id,year,month" }
        )
      })

      const [, payload] = upsertMock.mock.calls[0] as [
        string,
        Record<string, unknown>,
        unknown,
      ]

      // El sueldo ya guardado no viaja en el payload de la cotización.
      expect("salary_ars" in payload).toBe(false)
      expect(typeof payload.exchange_rate_fetched_at).toBe("string")

      expect(
        (await screen.findAllByText(/2\.008,50 por USD/)).length
      ).toBeGreaterThan(0)
    })

    it("conserva la cotización anterior cuando falla la consulta", async () => {
      setBudget(2026, 3, {
        salary_ars: 1_000_000,
        exchange_rate_value: 1640,
        exchange_rate_source: "api",
        exchange_rate_fetched_at: "2026-03-01T12:00:00.000Z",
        exchange_rate_source_updated_at: "2026-03-01T11:00:00.000Z",
      })
      scenario.otherExpenses = [usdExpense]
      stubFetch(new Error("network down"))

      renderBudgetPage()

      fireEvent.click(
        await screen.findByRole("button", { name: "Actualizar cotización" })
      )

      expect(
        await screen.findByText(
          "No pudimos consultar la cotización. Intentá de nuevo en un momento."
        )
      ).toBeDefined()
      expect(screen.queryByText("¿Aplicar esta cotización?")).toBeNull()
      expect(screen.getByText(/1\.640,00 por USD/)).toBeDefined()
      expect(upsertMock).not.toHaveBeenCalled()
    })

    it("guarda una cotización manual después de ver su impacto", async () => {
      setBudget(2026, 3, { salary_ars: 1_000_000, exchange_rate_value: 1640 })
      scenario.otherExpenses = [usdExpense]

      renderBudgetPage()

      fireEvent.click(
        await screen.findByRole("button", { name: "Editar manualmente" })
      )

      const rateField = await screen.findByLabelText(
        "Cotización manual (ARS por USD)"
      )
      fireEvent.change(rateField, { target: { value: "0" } })
      fireEvent.click(screen.getByRole("button", { name: "Ver impacto" }))

      expect(
        await screen.findByText("Ingresá una cotización mayor que cero.")
      ).toBeDefined()
      expect(screen.queryByText("¿Aplicar esta cotización?")).toBeNull()

      fireEvent.change(rateField, { target: { value: "2500" } })
      fireEvent.click(screen.getByRole("button", { name: "Ver impacto" }))

      expect(await screen.findByText("¿Aplicar esta cotización?")).toBeDefined()
      expect(screen.getByText(/2\.500,00 por USD/)).toBeDefined()

      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledWith(
          "monthly_budgets",
          expect.objectContaining({
            year: 2026,
            month: 3,
            exchange_rate_value: 2500,
            exchange_rate_source: "manual",
            exchange_rate_source_updated_at: null,
          }),
          { onConflict: "user_id,year,month" }
        )
      })
    })

    it("no cambia nada cuando se cancela la vista previa", async () => {
      setBudget(2026, 3, {
        salary_ars: 1_000_000,
        exchange_rate_value: 1640,
        exchange_rate_source: "manual",
        exchange_rate_fetched_at: "2026-03-01T12:00:00.000Z",
      })
      scenario.otherExpenses = [usdExpense]
      stubFetch({
        venta: 2008.5,
        fechaActualizacion: "2026-03-10T18:55:00.000Z",
      })

      renderBudgetPage()

      fireEvent.click(
        await screen.findByRole("button", { name: "Actualizar cotización" })
      )

      expect(await screen.findByText("¿Aplicar esta cotización?")).toBeDefined()

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

      await waitFor(() => {
        expect(screen.queryByText("¿Aplicar esta cotización?")).toBeNull()
      })

      expect(upsertMock).not.toHaveBeenCalled()
      expect(screen.getByText(/1\.640,00 por USD/)).toBeDefined()
      expect(screen.queryByText(/2\.008,50 por USD/)).toBeNull()
    })
  })
})

describe("MonthlyBudgetPage: acciones sobre los gastos del mes", () => {
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

  it("cada línea ofrece las acciones de la feature dueña de su tipo", async () => {
    scenario.expenseOccurrences = [
      {
        id: "occurrence-1",
        amount: 45_000,
        installment_number: 3,
        spending_plans: {
          id: "plan-notebook",
          kind: "card_purchase",
          concept: "Notebook",
          group_label: "BBVA",
          currency: "ars",
          total_installments: 6,
        },
      },
      {
        id: "occurrence-2",
        amount: 30_000,
        installment_number: null,
        spending_plans: {
          id: "plan-internet",
          kind: "recurring",
          concept: "Internet",
          group_label: "Otros gastos",
          currency: "ars",
          total_installments: null,
        },
      },
    ]
    scenario.otherExpenses = [
      {
        id: "other-1",
        concept: "Supermercado",
        amount: 85_000,
        currency: "ars",
      },
    ]

    renderBudgetPage()

    const cardRow = within(await screen.findByRole("row", { name: /Notebook/ }))
    const recurringRow = within(screen.getByRole("row", { name: /Internet/ }))
    const otherRow = within(screen.getByRole("row", { name: /Supermercado/ }))

    expect(cardRow.getByRole("button", { name: "Editar" })).toBeDefined()
    expect(cardRow.getByRole("button", { name: "Eliminar" })).toBeDefined()

    // Un recurrente además puede corregir el importe del mes y detenerse, que
    // no son un alta ni una baja.
    expect(
      recurringRow.getByRole("button", { name: "Corregir importe" })
    ).toBeDefined()
    expect(recurringRow.getByRole("button", { name: "Detener" })).toBeDefined()

    expect(otherRow.getByRole("button", { name: "Editar" })).toBeDefined()
    expect(otherRow.getByRole("button", { name: "Eliminar" })).toBeDefined()
  })

  it("«Agregar gasto» ofrece un formulario por tipo, el lote y la generación de recurrentes", async () => {
    renderBudgetPage()

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar gasto" })
    )

    for (const option of [
      "Compra con tarjeta",
      "Cargar varias compras",
      "Préstamo",
      "Gasto recurrente",
      "Generar recurrentes de este mes",
      "Otro gasto",
    ]) {
      expect(await screen.findByRole("button", { name: option })).toBeDefined()
    }
  })
})
