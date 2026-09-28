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
import { CardPurchasesPage } from "@/features/card-purchases/components/card-purchases-page"
import { getCurrentPeriod, type Period } from "@/shared/lib/period"

type StoredBudget = {
  salary_ars: number | null
  exchange_rate_value: number | null
}

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
      budgets: new Map<string, StoredBudget>(),
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

        if (table === "monthly_budgets") {
          const stored = scenario.budgets.get(
            `${filters.year}-${filters.month}`
          )

          return { data: stored ?? null, error: null }
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

const setBudget = ({ year, month }: Period, budget: StoredBudget) => {
  scenario.budgets.set(`${year}-${month}`, budget)
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

const renderCardPurchasesPage = (period: Period = VIEWED_PERIOD) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter
          initialEntries={[`/months/${period.year}/${period.month}/cards`]}
        >
          <Routes>
            <Route
              path="/months/:year/:month/cards"
              element={<CardPurchasesPage />}
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
// of reacting to a change event on a native <select>. An item only commits a
// real mouse selection, so the pointer press has to precede the click.
const selectOption = (fieldLabel: string, optionLabel: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: fieldLabel }))

  const option = screen.getByRole("option", { name: optionLabel })

  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe("CardPurchasesPage", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    scenario.occurrences = []
    scenario.budgets.clear()
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
    renderCardPurchasesPage()

    expect(
      await screen.findByText(
        "Todavía no cargaste compras con tarjeta para este mes."
      )
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Agregar compra" })).toBeDefined()
  })

  it("agrupa las compras por tarjeta, marca la última cuota y deja fuera otros planes", async () => {
    setOccurrences([
      notebookOccurrence,
      lastInstallmentOccurrence,
      loanOccurrence,
    ])

    renderCardPurchasesPage()

    expect(await screen.findByText("Notebook")).toBeDefined()
    expect(screen.getByText("BBVA")).toBeDefined()
    expect(screen.getByText("Supervielle")).toBeDefined()
    expect(screen.queryByText("Préstamo del banco")).toBeNull()

    expect(rowOf("Notebook").getByText("4/6")).toBeDefined()
    expect(rowOf("Notebook").queryByText("Última cuota")).toBeNull()
    expect(rowOf("Auriculares").getByText("3/3")).toBeDefined()
    expect(rowOf("Auriculares").getByText("Última cuota")).toBeDefined()

    expect(selectFiltersMock).toHaveBeenCalledWith("expense_occurrences", {
      year: VIEWED_PERIOD.year,
      month: VIEWED_PERIOD.month,
      "spending_plans.kind": "card_purchase",
    })
  })

  it("muestra «Sin dato» en el equivalente en ARS cuando el mes no tiene cotización", async () => {
    setOccurrences([lastInstallmentOccurrence])

    renderCardPurchasesPage()

    expect(await screen.findByText("Equivalente en ARS")).toBeDefined()
    expect(rowOf("Auriculares").getByText("Sin dato")).toBeDefined()
  })

  it("convierte la cuota en USD con la cotización guardada del mes", async () => {
    setBudget(VIEWED_PERIOD, { salary_ars: null, exchange_rate_value: 1500 })
    setOccurrences([lastInstallmentOccurrence])

    renderCardPurchasesPage()

    // 120 USD * 1500 = 180.000 ARS.
    await screen.findByRole("row", { name: /Auriculares/ })
    expect(rowOf("Auriculares").getByText(/180\.000,00/)).toBeDefined()
    expect(rowOf("Auriculares").queryByText("Sin dato")).toBeNull()
  })

  it("solo ofrece meses del mes real actual hasta diciembre, sin pedir el año", async () => {
    renderCardPurchasesPage()

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar compra" })
    )

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
    renderCardPurchasesPage()

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar compra" })
    )

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
    renderCardPurchasesPage()

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar compra" })
    )

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
    renderCardPurchasesPage()

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar compra" })
    )

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

    renderCardPurchasesPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Notebook/ })
      ).findByRole("button", { name: "Editar" })
    )

    fireEvent.change(screen.getByLabelText("Importe de la cuota"), {
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

    renderCardPurchasesPage()

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

    renderCardPurchasesPage()

    expect(
      await screen.findByText(
        "No pudimos cargar las compras con tarjeta del mes. Intentá de nuevo en un momento."
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
  fireEvent.click(await screen.findByRole("button", { name: "Agregar compra" }))

  fillPurchase({
    concept: "  notebook ",
    quotaAmount: "45000",
    startingInstallment: "4",
    totalInstallments: "6",
  })
}

describe("CardPurchasesPage: carga rápida (RF-09)", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    scenario.occurrences = []
    scenario.budgets.clear()
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
    renderCardPurchasesPage(CURRENT_PERIOD)

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar compra" })
    )

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
    renderCardPurchasesPage(CURRENT_PERIOD)

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar compra" })
    )

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

    renderCardPurchasesPage(CURRENT_PERIOD)

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

    renderCardPurchasesPage(CURRENT_PERIOD)

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

    renderCardPurchasesPage(CURRENT_PERIOD)

    await openFormAndRepeatNotebook()

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalled()
    })
    expect(screen.queryByText("¿Ya cargaste esta compra?")).toBeNull()
  })
})
