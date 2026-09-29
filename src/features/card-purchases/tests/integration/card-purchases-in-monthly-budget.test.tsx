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
import { getCurrentPeriod, type Period } from "@/shared/lib/period"

type StoredOccurrence = {
  id: string
  plan_id: string
  amount: number | null
  installment_number: number | null
  spending_plans: {
    id: string
    concept: string
    group_label: string
    currency: string
    total_installments: number | null
    kind: string
  }
}

const { authMock, fromMock, rpcMock, deleteMock, selectFiltersMock, scenario } =
  vi.hoisted(() => {
    type QueryResult = { data: unknown; error: { message: string } | null }

    type Occurrence = {
      spending_plans: { kind: string }
    }

    const scenario = {
      occurrences: [] as Occurrence[],
      loadError: null as { message: string } | null,
      deleteError: null as { message: string } | null,
      rpcError: null as { message: string } | null,
    }

    const rpcMock = vi.fn(() =>
      Promise.resolve({ data: null, error: scenario.rpcError })
    )
    const deleteMock = vi.fn()
    const selectFiltersMock = vi.fn()

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

        selectFiltersMock(table, filters)

        // The budget reads its salary elsewhere; this suite only cares about
        // the card purchases of the month.
        if (table === "monthly_budgets") {
          return { data: null, error: null }
        }

        // The budget reads its one-off expenses from another table; this suite
        // only cares about the card purchases of the month.
        if (table === "other_expenses") {
          return { data: [], error: null }
        }

        // The real query filters the embedded plan with "!inner"; the mock
        // applies the same filter so a missing one would show other kinds.
        const kindFilter = filters["spending_plans.kind"]
        const rows = scenario.occurrences.filter(
          (occurrence) =>
            kindFilter === undefined ||
            occurrence.spending_plans.kind === kindFilter
        )

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
        maybeSingle: () => Promise.resolve(result()),
        then: <TFulfilled = QueryResult, TRejected = never>(
          onfulfilled?:
            | ((value: QueryResult) => TFulfilled | PromiseLike<TFulfilled>)
            | null,
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
      selectFiltersMock,
      scenario,
    }
  })

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { auth: authMock, from: fromMock, rpc: rpcMock },
}))

const notebookOccurrence: StoredOccurrence = {
  id: "occurrence-1",
  plan_id: "plan-1",
  amount: 45_000,
  installment_number: 4,
  spending_plans: {
    id: "plan-1",
    concept: "Notebook",
    group_label: "BBVA",
    currency: "ars",
    total_installments: 6,
    kind: "card_purchase",
  },
}

const lastInstallmentOccurrence: StoredOccurrence = {
  id: "occurrence-2",
  plan_id: "plan-2",
  amount: 120,
  installment_number: 3,
  spending_plans: {
    id: "plan-2",
    concept: "Auriculares",
    group_label: "Supervielle",
    currency: "usd",
    total_installments: 3,
    kind: "card_purchase",
  },
}

const loanOccurrence: StoredOccurrence = {
  id: "occurrence-3",
  plan_id: "plan-3",
  amount: 120_000,
  installment_number: 2,
  spending_plans: {
    id: "plan-3",
    concept: "Préstamo del banco",
    group_label: "Préstamos",
    currency: "ars",
    total_installments: 12,
    kind: "loan",
  },
}

const setOccurrences = (occurrences: StoredOccurrence[]) => {
  scenario.occurrences = occurrences
}

// The route decides which month the page is looking at; the form, instead,
// always works against the real current month.
const VIEWED_PERIOD: Period = { year: 2026, month: 3 }

const MONTHS_PER_YEAR = 12

const monthNameFormatter = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "UTC",
})

const monthLabel = ({ year, month }: Period) => {
  const name = monthNameFormatter.format(Date.UTC(year, month - 1, 1))

  return name.charAt(0).toUpperCase() + name.slice(1)
}

const renderBudgetPage = (period: Period = VIEWED_PERIOD) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter
          initialEntries={[`/months/${period.year}/${period.month}`]}
        >
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

/**
 * Every load starts at the budget's single entry point: the type of expense is
 * chosen there, and only then the feature's own form opens.
 */
const openAddExpense = async (optionLabel: string) => {
  fireEvent.click(await screen.findByRole("button", { name: "Agregar gasto" }))
  fireEvent.click(await screen.findByRole("button", { name: optionLabel }))
}

const openPurchaseForm = async () => {
  await openAddExpense("Compra con tarjeta")

  // The form waits for the purchases of the month before opening (RF-09).
  await screen.findByLabelText("Concepto")
}

const rowOf = (concept: string) =>
  within(screen.getByRole("row", { name: new RegExp(concept) }))

// The shadcn Select is a Base UI combobox: it opens a portaled listbox instead
// of reacting to a change event on a native <select>. An item only commits a
// real mouse selection, so the pointer press has to precede the click.
const selectOption = (fieldLabel: string, optionLabel: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: fieldLabel }))

  const option = screen.getByRole("option", { name: optionLabel })

  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe("compras con tarjeta desde Presupuesto", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
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

  it("muestra el mes vacío sin perder el acceso a cargar una compra", async () => {
    renderBudgetPage()

    expect(
      await screen.findByText("Todavía no cargaste gastos para este mes.")
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Agregar gasto" })).toBeDefined()
  })

  it("lista la compra en el mes, marca la última cuota y consulta solo las compras con tarjeta al abrir el formulario", async () => {
    setOccurrences([
      notebookOccurrence,
      lastInstallmentOccurrence,
      loanOccurrence,
    ])

    renderBudgetPage()

    expect(await screen.findByText("Notebook")).toBeDefined()
    expect(screen.getByRole("heading", { name: "BBVA" })).toBeDefined()
    expect(rowOf("Notebook").getByText("4/6")).toBeDefined()
    expect(rowOf("Notebook").queryByText("Última cuota")).toBeNull()
    expect(rowOf("Auriculares").getByText("3/3")).toBeDefined()
    expect(rowOf("Auriculares").getByText("Última cuota")).toBeDefined()

    await openPurchaseForm()

    // RF-09: the duplicate warning compares against the purchases of the
    // month, so the form reads them with the same "!inner" kind filter.
    await waitFor(() => {
      expect(selectFiltersMock).toHaveBeenCalledWith("expense_occurrences", {
        year: VIEWED_PERIOD.year,
        month: VIEWED_PERIOD.month,
        "spending_plans.kind": "card_purchase",
      })
    })
  })

  it("solo ofrece meses del mes real actual hasta diciembre, sin pedir el año", async () => {
    renderBudgetPage()

    await openPurchaseForm()

    expect(screen.queryByLabelText("Año de la cuota")).toBeNull()

    fireEvent.click(screen.getByRole("combobox", { name: "Mes de la cuota" }))

    const currentPeriod = getCurrentPeriod()
    const offeredMonths = Array.from(
      { length: MONTHS_PER_YEAR - currentPeriod.month + 1 },
      (_value, index) =>
        monthLabel({
          year: currentPeriod.year,
          month: currentPeriod.month + index,
        })
    )

    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toEqual(offeredMonths)
  })

  it("crea una compra con los datos que el usuario eligió", async () => {
    renderBudgetPage()

    await openPurchaseForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Notebook" },
    })
    selectOption("Tarjeta", "Supervielle")
    fireEvent.change(screen.getByLabelText("Importe de la cuota"), {
      target: { value: "45000" },
    })
    fireEvent.change(screen.getByLabelText("Cuota que se carga"), {
      target: { value: "3" },
    })
    fireEvent.change(screen.getByLabelText("Total de cuotas"), {
      target: { value: "6" },
    })
    const lastMonthOfCurrentYear: Period = {
      year: getCurrentPeriod().year,
      month: MONTHS_PER_YEAR,
    }

    selectOption("Mes de la cuota", monthLabel(lastMonthOfCurrentYear))

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("create_card_purchase", {
        p_concept: "Notebook",
        p_card: "Supervielle",
        p_currency: "ars",
        p_quota_amount: 45_000,
        p_starting_installment: 3,
        p_total_installments: 6,
        p_year: lastMonthOfCurrentYear.year,
        p_month: lastMonthOfCurrentYear.month,
      })
    })
  })

  it("«Un pago» fuerza cuota 1 de 1 sin pedir los números de cuota", async () => {
    renderBudgetPage()

    await openPurchaseForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Auriculares" },
    })
    fireEvent.change(screen.getByLabelText("Importe de la cuota"), {
      target: { value: "25000" },
    })
    fireEvent.click(screen.getByRole("checkbox", { name: /Un pago/ }))

    expect(screen.queryByLabelText("Cuota que se carga")).toBeNull()
    expect(screen.queryByLabelText("Total de cuotas")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_card_purchase",
        expect.objectContaining({
          p_starting_installment: 1,
          p_total_installments: 1,
        })
      )
    })
  })

  it("no deja guardar una cuota inicial mayor al total de cuotas", async () => {
    renderBudgetPage()

    await openPurchaseForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Notebook" },
    })
    fireEvent.change(screen.getByLabelText("Importe de la cuota"), {
      target: { value: "45000" },
    })
    fireEvent.change(screen.getByLabelText("Cuota que se carga"), {
      target: { value: "7" },
    })
    fireEvent.change(screen.getByLabelText("Total de cuotas"), {
      target: { value: "6" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))

    expect(
      await screen.findByText(
        "La cuota inicial no puede superar el total de cuotas"
      )
    ).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("edita la compra desde la cuota y el mes de la fila editada", async () => {
    setOccurrences([notebookOccurrence])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Notebook/ })
      ).findByRole("button", { name: "Editar" })
    )

    fireEvent.change(await screen.findByLabelText("Importe de la cuota"), {
      target: { value: "50000" },
    })
    fireEvent.change(screen.getByLabelText("Total de cuotas"), {
      target: { value: "8" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("update_card_purchase", {
        p_plan_id: "plan-1",
        p_concept: "Notebook",
        p_card: "BBVA",
        p_currency: "ars",
        p_quota_amount: 50_000,
        p_from_installment: 4,
        p_from_year: VIEWED_PERIOD.year,
        p_from_month: VIEWED_PERIOD.month,
        p_total_installments: 8,
      })
    })
  })

  it("elimina la compra solo después de confirmar", async () => {
    setOccurrences([notebookOccurrence])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Notebook/ })
      ).findByRole("button", { name: "Eliminar" })
    )

    expect(deleteMock).not.toHaveBeenCalled()
    expect(await screen.findByText("¿Eliminar esta compra?")).toBeDefined()
    expect(
      screen.getByText(
        "Se van a borrar todas las cuotas de «Notebook», pasadas y futuras. Esta acción no se puede deshacer."
      )
    ).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("spending_plans", {
        id: "plan-1",
      })
    })
  })

  it("muestra un error genérico sin filtrar el detalle de Supabase", async () => {
    scenario.loadError = { message: "database exploded" }

    renderBudgetPage()

    expect(
      await screen.findByText(
        "No pudimos cargar el presupuesto del mes. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
    expect(screen.queryByText(/database exploded/)).toBeNull()
  })
})

// RF-09: the quick entry works against the month the form imputes to, which
// is the real current month unless the user picks a later one.
const CURRENT_PERIOD = getCurrentPeriod()

type PurchaseFields = {
  concept: string
  quotaAmount: string
  startingInstallment: string
  totalInstallments: string
}

const fillPurchase = ({
  concept,
  quotaAmount,
  startingInstallment,
  totalInstallments,
}: PurchaseFields) => {
  fireEvent.change(screen.getByLabelText("Concepto"), {
    target: { value: concept },
  })
  fireEvent.change(screen.getByLabelText("Importe de la cuota"), {
    target: { value: quotaAmount },
  })
  fireEvent.change(screen.getByLabelText("Cuota que se carga"), {
    target: { value: startingInstallment },
  })
  fireEvent.change(screen.getByLabelText("Total de cuotas"), {
    target: { value: totalInstallments },
  })
}

// The same purchase already loaded in the month, retyped with a different
// casing and stray spaces: RF-09 still considers it «muy parecido».
const openFormAndRepeatNotebook = async () => {
  await openPurchaseForm()

  await screen.findByLabelText("Concepto")

  fillPurchase({
    concept: "  notebook ",
    quotaAmount: "45000",
    startingInstallment: "4",
    totalInstallments: "6",
  })
}

describe("compras con tarjeta desde Presupuesto: carga rápida (RF-09)", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
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

  it("«Guardar y agregar otro» guarda y deja el formulario abierto y en blanco", async () => {
    renderBudgetPage(CURRENT_PERIOD)

    await openPurchaseForm()

    await screen.findByLabelText("Concepto")

    fillPurchase({
      concept: "Notebook",
      quotaAmount: "45000",
      startingInstallment: "3",
      totalInstallments: "6",
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar y agregar otro" })
    )

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_card_purchase",
        expect.objectContaining({
          p_concept: "Notebook",
          p_starting_installment: 3,
          p_total_installments: 6,
        })
      )
    })

    // The form stays open, reset to its defaults: nothing is dragged from the
    // previous purchase, not even the installment number.
    await waitFor(() => {
      expect(screen.getByLabelText("Concepto")).toHaveProperty("value", "")
    })
    expect(screen.getByLabelText("Importe de la cuota")).toHaveProperty(
      "value",
      ""
    )
    expect(screen.getByLabelText("Cuota que se carga")).toHaveProperty(
      "value",
      "1"
    )
    expect(screen.getByLabelText("Total de cuotas")).toHaveProperty(
      "value",
      "1"
    )
  })

  it("«Guardar compra» sigue cerrando el formulario", async () => {
    renderBudgetPage(CURRENT_PERIOD)

    await openPurchaseForm()

    await screen.findByLabelText("Concepto")

    fillPurchase({
      concept: "Notebook",
      quotaAmount: "45000",
      startingInstallment: "3",
      totalInstallments: "6",
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))

    await waitFor(() => {
      expect(screen.queryByLabelText("Concepto")).toBeNull()
    })
  })

  it("avisa del posible duplicado y no guarda nada si el usuario revisa", async () => {
    setOccurrences([notebookOccurrence])

    renderBudgetPage(CURRENT_PERIOD)

    await openFormAndRepeatNotebook()

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))

    expect(await screen.findByText("¿Ya cargaste esta compra?")).toBeDefined()
    expect(
      screen.getByText(/Ya existe un gasto muy parecido: «Notebook» en BBVA/)
    ).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Revisar" }))

    await waitFor(() => {
      expect(screen.queryByText("¿Ya cargaste esta compra?")).toBeNull()
    })
    expect(rpcMock).not.toHaveBeenCalled()
    // The draft is still there, so the user can compare it with the row.
    expect(screen.getByLabelText("Concepto")).toHaveProperty(
      "value",
      "  notebook "
    )
  })

  it("guarda igual cuando el usuario confirma el aviso", async () => {
    setOccurrences([notebookOccurrence])

    renderBudgetPage(CURRENT_PERIOD)

    await openFormAndRepeatNotebook()

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))
    fireEvent.click(await screen.findByRole("button", { name: "Cargar igual" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_card_purchase",
        expect.objectContaining({
          p_concept: "notebook",
          p_quota_amount: 45_000,
          p_starting_installment: 4,
          p_total_installments: 6,
        })
      )
    })
  })

  it("no interrumpe el caso normal: otro importe no es un duplicado", async () => {
    setOccurrences([{ ...notebookOccurrence, amount: 30_000 }])

    renderBudgetPage(CURRENT_PERIOD)

    await openFormAndRepeatNotebook()

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalled()
    })
    expect(screen.queryByText("¿Ya cargaste esta compra?")).toBeNull()
  })
})

// RF-09 "carga de varios gastos": the batch shares the card and the month of
// the route, so every item only carries its own fields.
type BatchItemFields = {
  concept: string
  quotaAmount: string
  startingInstallment: string
  totalInstallments: string
}

const groupOf = (name: string) => within(screen.getByRole("group", { name }))

const selectOptionIn = (
  groupName: string,
  fieldLabel: string,
  optionLabel: string
) => {
  fireEvent.click(
    groupOf(groupName).getByRole("combobox", { name: fieldLabel })
  )

  const option = screen.getByRole("option", { name: optionLabel })

  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

const fillBatchItem = (
  groupName: string,
  {
    concept,
    quotaAmount,
    startingInstallment,
    totalInstallments,
  }: BatchItemFields
) => {
  const group = groupOf(groupName)

  fireEvent.change(group.getByLabelText("Concepto"), {
    target: { value: concept },
  })
  fireEvent.change(group.getByLabelText("Importe de la cuota"), {
    target: { value: quotaAmount },
  })
  fireEvent.change(group.getByLabelText("Cuota que se carga"), {
    target: { value: startingInstallment },
  })
  fireEvent.change(group.getByLabelText("Total de cuotas"), {
    target: { value: totalInstallments },
  })
}

const DRAFT_GROUP = "Nueva compra del lote"

const addBatchItem = (fields: BatchItemFields) => {
  fillBatchItem(DRAFT_GROUP, fields)
  fireEvent.click(screen.getByRole("button", { name: "Agregar a la lista" }))
}

const openBatchPanel = async () => {
  await openAddExpense("Cargar varias compras")

  await screen.findByRole("group", { name: DRAFT_GROUP })
}

describe("compras con tarjeta desde Presupuesto: carga de varias compras (RF-09)", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
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

  it("guarda varias compras del mes en una sola llamada atómica", async () => {
    renderBudgetPage()

    await openBatchPanel()

    selectOptionIn("Nueva compra del lote", "Moneda", "Pesos (ARS)")
    selectOption("Tarjeta del lote", "Supervielle")

    addBatchItem({
      concept: "Notebook",
      quotaAmount: "45000",
      startingInstallment: "3",
      totalInstallments: "6",
    })
    addBatchItem({
      concept: "Monitor",
      quotaAmount: "30000",
      startingInstallment: "1",
      totalInstallments: "3",
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar lote" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("create_card_purchases_batch", {
        p_card: "Supervielle",
        p_year: VIEWED_PERIOD.year,
        p_month: VIEWED_PERIOD.month,
        p_items: [
          {
            concept: "Notebook",
            currency: "ars",
            quota_amount: 45_000,
            starting_installment: 3,
            total_installments: 6,
          },
          {
            concept: "Monitor",
            currency: "ars",
            quota_amount: 30_000,
            starting_installment: 1,
            total_installments: 3,
          },
        ],
      })
    })
  })

  it("deja corregir y quitar ítems antes de confirmar el lote", async () => {
    renderBudgetPage()

    await openBatchPanel()

    addBatchItem({
      concept: "Notebok",
      quotaAmount: "45000",
      startingInstallment: "3",
      totalInstallments: "6",
    })
    addBatchItem({
      concept: "Monitor",
      quotaAmount: "30000",
      startingInstallment: "1",
      totalInstallments: "3",
    })

    fireEvent.change(groupOf("Compra 1").getByLabelText("Concepto"), {
      target: { value: "Notebook" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Quitar compra 2" }))

    expect(screen.queryByRole("group", { name: "Compra 2" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Guardar lote" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_card_purchases_batch",
        expect.objectContaining({
          p_items: [
            {
              concept: "Notebook",
              currency: "ars",
              quota_amount: 45_000,
              starting_installment: 3,
              total_installments: 6,
            },
          ],
        })
      )
    })
  })

  it("un ítem inválido bloquea el guardado de todo el lote", async () => {
    renderBudgetPage()

    await openBatchPanel()

    addBatchItem({
      concept: "Notebook",
      quotaAmount: "45000",
      startingInstallment: "3",
      totalInstallments: "6",
    })
    addBatchItem({
      concept: "Monitor",
      quotaAmount: "30000",
      startingInstallment: "1",
      totalInstallments: "3",
    })

    // The second item is corrected into an impossible installment after being
    // added: the whole batch has to stop, not save the valid one.
    fireEvent.change(groupOf("Compra 2").getByLabelText("Total de cuotas"), {
      target: { value: "1" },
    })
    fireEvent.change(groupOf("Compra 2").getByLabelText("Cuota que se carga"), {
      target: { value: "5" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar lote" }))

    expect(
      await screen.findByText(
        "Revisá la compra 2 de la lista: todavía tiene datos incompletos. No se guardó nada."
      )
    ).toBeDefined()
    expect(
      groupOf("Compra 2").getByText(
        "La cuota inicial no puede superar el total de cuotas"
      )
    ).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("avisa cuando el ítem repite un gasto ya cargado del mes", async () => {
    setOccurrences([notebookOccurrence])

    renderBudgetPage()

    await openBatchPanel()

    fillBatchItem(DRAFT_GROUP, {
      concept: "  notebook ",
      quotaAmount: "45000",
      startingInstallment: "4",
      totalInstallments: "6",
    })
    fireEvent.click(screen.getByRole("button", { name: "Agregar a la lista" }))

    expect(await screen.findByText("¿Ya cargaste esta compra?")).toBeDefined()
    expect(screen.queryByRole("group", { name: "Compra 1" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Cargar igual" }))

    expect(await screen.findByRole("group", { name: "Compra 1" })).toBeDefined()
  })

  it("avisa cuando el ítem repite otro ítem del mismo lote", async () => {
    renderBudgetPage()

    await openBatchPanel()

    addBatchItem({
      concept: "Notebook",
      quotaAmount: "45000",
      startingInstallment: "3",
      totalInstallments: "6",
    })

    fillBatchItem(DRAFT_GROUP, {
      concept: "NOTEBOOK",
      quotaAmount: "45000",
      startingInstallment: "3",
      totalInstallments: "6",
    })
    fireEvent.click(screen.getByRole("button", { name: "Agregar a la lista" }))

    expect(await screen.findByText("¿Ya cargaste esta compra?")).toBeDefined()
    expect(screen.queryByRole("group", { name: "Compra 2" })).toBeNull()

    // «Revisar» never adds the item: the list keeps the single purchase.
    fireEvent.click(screen.getByRole("button", { name: "Revisar" }))

    await waitFor(() => {
      expect(screen.queryByText("¿Ya cargaste esta compra?")).toBeNull()
    })
    expect(screen.queryByRole("group", { name: "Compra 2" })).toBeNull()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
