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
import { RecurringExpensesPage } from "@/features/recurring-expenses/components/recurring-expenses-page"
import type { Period } from "@/shared/lib/period"

type StoredPlan = {
  id: string
  kind: string
  concept: string
  group_label: string
  currency: string
  default_amount: number | null
  total_installments: number | null
  stopped_from_year: number | null
  stopped_from_month: number | null
}

type StoredOccurrence = {
  id: string
  plan_id: string
  year: number
  month: number
  amount: number | null
  amount_is_estimated: boolean
  is_skipped: boolean
}

const { authMock, fromMock, rpcMock, deleteMock, scenario } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  const scenario = {
    plans: [] as StoredPlan[],
    occurrences: [] as StoredOccurrence[],
    loadError: null as { message: string } | null,
    deleteError: null as { message: string } | null,
    rpcError: null as { message: string } | null,
  }

  const rpcMock = vi.fn(() =>
    Promise.resolve({ data: null, error: scenario.rpcError })
  )
  const deleteMock = vi.fn()

  const planOf = (planId: string) =>
    scenario.plans.find((plan) => plan.id === planId)

  const createBuilder = (table: string) => {
    const filters: Record<string, unknown> = {}
    let isDelete = false

    const result = (): QueryResult => {
      if (isDelete) {
        deleteMock(table, filters)

        return { data: null, error: scenario.deleteError }
      }

      if (scenario.loadError !== null) {
        return { data: null, error: scenario.loadError }
      }

      if (table === "spending_plans") {
        const plans = scenario.plans
          .filter((plan) => plan.kind === filters.kind)
          .map((plan) => ({
            ...plan,
            expense_occurrences: scenario.occurrences.filter(
              (occurrence) => occurrence.plan_id === plan.id
            ),
          }))

        return { data: plans, error: null }
      }

      // The real query filters the embedded plan with "!inner"; the mock
      // applies the same filter so a missing one would show other kinds.
      const rows = scenario.occurrences
        .filter((occurrence) => {
          const plan = planOf(occurrence.plan_id)

          return (
            plan !== undefined &&
            plan.kind === filters["spending_plans.kind"] &&
            occurrence.year === filters.year &&
            occurrence.month === filters.month
          )
        })
        .map((occurrence) => ({
          ...occurrence,
          spending_plans: planOf(occurrence.plan_id),
        }))

      return { data: rows, error: null }
    }

    const builder = {
      select: () => builder,
      delete: () => {
        isDelete = true

        return builder
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value

        return builder
      },
      order: () => builder,
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
    rpcMock,
    deleteMock,
    scenario,
  }
})

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { auth: authMock, from: fromMock, rpc: rpcMock },
}))

// The route decides which month the page is looking at.
const VIEWED_PERIOD: Period = { year: 2026, month: 3 }

const internetPlan: StoredPlan = {
  id: "plan-internet",
  kind: "recurring",
  concept: "Internet",
  group_label: "Otros gastos",
  currency: "ars",
  default_amount: 45_000,
  total_installments: null,
  stopped_from_year: null,
  stopped_from_month: null,
}

const electricityPlan: StoredPlan = {
  id: "plan-luz",
  kind: "recurring",
  concept: "Luz",
  group_label: "Otros gastos",
  currency: "ars",
  default_amount: null,
  total_installments: null,
  stopped_from_year: null,
  stopped_from_month: null,
}

const cardPlan: StoredPlan = {
  id: "plan-notebook",
  kind: "card_purchase",
  concept: "Notebook",
  group_label: "BBVA",
  currency: "ars",
  default_amount: null,
  total_installments: 6,
  stopped_from_year: null,
  stopped_from_month: null,
}

const internetMarch: StoredOccurrence = {
  id: "occurrence-internet-march",
  plan_id: internetPlan.id,
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month,
  amount: 45_000,
  amount_is_estimated: false,
  is_skipped: false,
}

const electricityFebruary: StoredOccurrence = {
  id: "occurrence-luz-february",
  plan_id: electricityPlan.id,
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month - 1,
  amount: 32_500,
  amount_is_estimated: false,
  is_skipped: false,
}

const notebookMarch: StoredOccurrence = {
  id: "occurrence-notebook-march",
  plan_id: cardPlan.id,
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month,
  amount: 120_000,
  amount_is_estimated: false,
  is_skipped: false,
}

const renderRecurringPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter
          initialEntries={[
            `/months/${VIEWED_PERIOD.year}/${VIEWED_PERIOD.month}/recurring`,
          ]}
        >
          <Routes>
            <Route
              path="/months/:year/:month/recurring"
              element={<RecurringExpensesPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const rowOf = (concept: string) =>
  within(screen.getByRole("row", { name: new RegExp(concept) }))

// The shadcn Select is a Base UI combobox: it opens a portaled listbox instead
// of rendering native options, so a plain change event would not select.
const selectOption = (fieldLabel: string, optionLabel: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: fieldLabel }))

  const option = screen.getByRole("option", { name: optionLabel })

  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

const openCreateForm = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Agregar recurrente" })
  )
}

describe("RecurringExpensesPage", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    scenario.plans = []
    scenario.occurrences = []
    scenario.loadError = null
    scenario.deleteError = null
    scenario.rpcError = null

    authMock.getSession.mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    })
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it("muestra el mes vacío sin generar nada por abrir la página", async () => {
    scenario.plans = [internetPlan]

    renderRecurringPage()

    expect(
      await screen.findByText("Todavía no generaste recurrentes para este mes.")
    ).toBeDefined()
    // Abrir el mes nunca escribe: la generación es siempre explícita.
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("lista los recurrentes del mes y deja fuera otros planes", async () => {
    scenario.plans = [internetPlan, cardPlan]
    scenario.occurrences = [internetMarch, notebookMarch]

    renderRecurringPage()

    expect(await screen.findByText("Internet")).toBeDefined()
    expect(screen.queryByText("Notebook")).toBeNull()
    expect(rowOf("Internet").getByText(/45\.000,00/)).toBeDefined()
  })

  it("crea un recurrente de importe fijo, mensual hasta detener", async () => {
    renderRecurringPage()
    await openCreateForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Internet" },
    })
    fireEvent.change(screen.getByLabelText("Importe de este mes"), {
      target: { value: "45000" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar recurrente" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("create_recurring_plan", {
        p_concept: "Internet",
        p_group_label: "Otros gastos",
        p_currency: "ars",
        p_default_amount: 45_000,
        p_year: VIEWED_PERIOD.year,
        p_month: VIEWED_PERIOD.month,
        p_starting_amount: 45_000,
      })
    })
  })

  it("crea un recurrente de importe variable con una cantidad fija de meses", async () => {
    renderRecurringPage()
    await openCreateForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Luz" },
    })
    selectOption("Tipo de importe", "Variable, se carga cada mes")
    selectOption("Repetición", "Cantidad fija de meses")
    fireEvent.change(screen.getByLabelText("Importe de este mes"), {
      target: { value: "32500" },
    })
    fireEvent.change(screen.getByLabelText("Cantidad de meses"), {
      target: { value: "6" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar recurrente" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("create_recurring_plan", {
        p_concept: "Luz",
        p_group_label: "Otros gastos",
        p_currency: "ars",
        p_total_installments: 6,
        p_year: VIEWED_PERIOD.year,
        p_month: VIEWED_PERIOD.month,
        p_starting_amount: 32_500,
      })
    })
  })

  it("crea un recurrente de una sola vez como un plan de un mes", async () => {
    renderRecurringPage()
    await openCreateForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Seguro anual" },
    })
    selectOption("Repetición", "Una sola vez")
    fireEvent.change(screen.getByLabelText("Importe de este mes"), {
      target: { value: "90000" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar recurrente" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_recurring_plan",
        expect.objectContaining({ p_total_installments: 1 })
      )
    })
  })

  it("no guarda un recurrente sin importe ni con una cantidad de meses inválida", async () => {
    renderRecurringPage()
    await openCreateForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Internet" },
    })
    selectOption("Repetición", "Cantidad fija de meses")
    fireEvent.change(screen.getByLabelText("Cantidad de meses"), {
      target: { value: "0" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar recurrente" }))

    expect(
      await screen.findByText("Ingresá el importe de este mes, mayor a cero")
    ).toBeDefined()
    expect(
      screen.getByText("Ingresá una cantidad de meses entera y positiva")
    ).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("genera el mes cargando un importe y omitiendo otro recurrente", async () => {
    scenario.plans = [internetPlan, electricityPlan]
    scenario.occurrences = [electricityFebruary]

    renderRecurringPage()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Generar recurrentes de este mes",
      })
    )

    // El fijo se prellena con su importe; el variable, con el último importe
    // real conocido y marcado como estimado.
    const fixedAmountField = await screen.findByLabelText("Importe de Internet")
    const variableAmountField = screen.getByLabelText("Importe de Luz")

    expect(fixedAmountField).toHaveProperty("value", "45.000,00")
    expect(variableAmountField).toHaveProperty("value", "32.500,00")
    expect(
      within(screen.getByRole("row", { name: /Luz/ })).getByText("Estimado")
    ).toBeDefined()

    fireEvent.click(
      within(screen.getByRole("row", { name: /Luz/ })).getByRole("radio", {
        name: "Omitir este mes",
      })
    )

    fireEvent.click(screen.getByRole("button", { name: "Generar recurrentes" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("set_recurring_occurrences", {
        p_year: VIEWED_PERIOD.year,
        p_month: VIEWED_PERIOD.month,
        p_items: [
          {
            plan_id: "plan-internet",
            action: "fill",
            amount: 45_000,
            is_estimated: false,
          },
          { plan_id: "plan-luz", action: "skip" },
        ],
      })
    })
  })

  it("no ofrece generar un recurrente detenido ni uno que ya cumplió sus meses", async () => {
    scenario.plans = [
      {
        ...internetPlan,
        stopped_from_year: VIEWED_PERIOD.year,
        stopped_from_month: VIEWED_PERIOD.month,
      },
      { ...electricityPlan, total_installments: 1 },
    ]
    scenario.occurrences = [electricityFebruary]

    renderRecurringPage()

    expect(
      await screen.findByText(
        "No hay recurrentes activos pendientes de generar en Marzo de 2026."
      )
    ).toBeDefined()
    expect(
      screen
        .getByRole("button", { name: "Generar recurrentes de este mes" })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("corrige el importe de este mes puntual sin tocar el plan", async () => {
    scenario.plans = [internetPlan]
    scenario.occurrences = [internetMarch]

    renderRecurringPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Internet/ })
      ).findByRole("button", { name: "Corregir importe" })
    )

    const amountField = await screen.findByLabelText("Importe de Marzo de 2026")

    expect(amountField).toHaveProperty("value", "45.000,00")

    fireEvent.change(amountField, { target: { value: "47500" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar importe" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("set_recurring_occurrence_amount", {
        p_occurrence_id: "occurrence-internet-march",
        p_amount: 47_500,
        p_is_estimated: false,
      })
    })
  })

  it("edita el plan aplicando el importe fijo nuevo desde el mes que se ve", async () => {
    scenario.plans = [internetPlan]
    scenario.occurrences = [internetMarch]

    renderRecurringPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Internet/ })
      ).findByRole("button", { name: "Editar" })
    )

    fireEvent.change(await screen.findByLabelText("Importe fijo"), {
      target: { value: "49000" },
    })
    selectOption("Agrupación", "BBVA")

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("update_recurring_plan", {
        p_plan_id: "plan-internet",
        p_concept: "Internet",
        p_group_label: "BBVA",
        p_currency: "ars",
        p_default_amount: 49_000,
        p_from_year: VIEWED_PERIOD.year,
        p_from_month: VIEWED_PERIOD.month,
      })
    })
  })

  it("detiene la repetición desde este mes solo después de confirmar", async () => {
    scenario.plans = [internetPlan]
    scenario.occurrences = [internetMarch]

    renderRecurringPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Internet/ })
      ).findByRole("button", { name: "Detener" })
    )

    expect(rpcMock).not.toHaveBeenCalled()
    expect(await screen.findByText("¿Detener este recurrente?")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Sí, detener" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("stop_recurring_plan", {
        p_plan_id: "plan-internet",
        p_from_year: VIEWED_PERIOD.year,
        p_from_month: VIEWED_PERIOD.month,
      })
    })
  })

  it("elimina el recurrente completo solo después de confirmar", async () => {
    scenario.plans = [internetPlan]
    scenario.occurrences = [internetMarch]

    renderRecurringPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Internet/ })
      ).findByRole("button", { name: "Eliminar" })
    )

    expect(deleteMock).not.toHaveBeenCalled()
    expect(await screen.findByText("¿Eliminar este recurrente?")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("spending_plans", {
        id: "plan-internet",
      })
    })
  })

  it("muestra el mes omitido como una ausencia explícita, sin importe que corregir", async () => {
    scenario.plans = [internetPlan]
    scenario.occurrences = [
      { ...internetMarch, amount: null, is_skipped: true },
    ]

    renderRecurringPage()

    const row = within(await screen.findByRole("row", { name: /Internet/ }))

    expect(row.getByText("Omitido este mes")).toBeDefined()
    expect(row.queryByText("Sin dato")).toBeNull()
    expect(
      row
        .getByRole("button", { name: "Corregir importe" })
        .hasAttribute("disabled")
    ).toBe(true)
  })

  it("muestra un error genérico sin filtrar el detalle de Supabase", async () => {
    scenario.loadError = { message: "database exploded" }

    renderRecurringPage()

    expect(
      await screen.findByText(
        "No pudimos cargar los recurrentes del mes. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
    expect(screen.queryByText(/database exploded/)).toBeNull()
  })
})
