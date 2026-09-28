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

const renderCardPurchasesPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/months/2026/3/cards"]}>
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
      year: 2026,
      month: 3,
      "spending_plans.kind": "card_purchase",
    })
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
    selectOption("Mes de la cuota", "Septiembre")

    fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("create_card_purchase", {
        p_concept: "Notebook",
        p_card: "Supervielle",
        p_currency: "ars",
        p_quota_amount: 45_000,
        p_starting_installment: 3,
        p_total_installments: 6,
        p_year: 2026,
        p_month: 9,
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
        p_from_year: 2026,
        p_from_month: 3,
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
