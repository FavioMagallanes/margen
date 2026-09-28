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
import { OtherExpensesPage } from "@/features/other-expenses/components/other-expenses-page"
import type { Period } from "@/shared/lib/period"

type StoredOtherExpense = {
  id: string
  concept: string
  amount: number
  currency: string
  payment_method: string | null
  year: number
  month: number
}

const {
  authMock,
  fromMock,
  insertMock,
  updateMock,
  deleteMock,
  selectFiltersMock,
  scenario,
} = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  type StoredRow = {
    year: number
    month: number
    concept: string
  }

  const scenario = {
    expenses: [] as StoredRow[],
    loadError: null as { message: string } | null,
    writeError: null as { message: string } | null,
  }

  const insertMock = vi.fn()
  const updateMock = vi.fn()
  const deleteMock = vi.fn()
  const selectFiltersMock = vi.fn()

  const createBuilder = (table: string) => {
    const filters: Record<string, unknown> = {}
    let operation: "select" | "insert" | "update" | "delete" = "select"
    let payload: unknown = null

    const result = (): QueryResult => {
      if (operation === "insert") {
        insertMock(table, payload)

        return { data: null, error: scenario.writeError }
      }

      if (operation === "update") {
        updateMock(table, payload, filters)

        return { data: null, error: scenario.writeError }
      }

      if (operation === "delete") {
        deleteMock(table, filters)

        return { data: null, error: scenario.writeError }
      }

      if (scenario.loadError !== null) {
        return { data: null, error: scenario.loadError }
      }

      selectFiltersMock(table, filters)

      const rows = scenario.expenses.filter(
        (expense) =>
          (filters.year === undefined || expense.year === filters.year) &&
          (filters.month === undefined || expense.month === filters.month)
      )

      return { data: rows, error: null }
    }

    const builder = {
      select: () => builder,
      insert: (values: unknown) => {
        operation = "insert"
        payload = values

        return builder
      },
      update: (values: unknown) => {
        operation = "update"
        payload = values

        return builder
      },
      delete: () => {
        operation = "delete"

        return builder
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value

        return builder
      },
      order: () => builder,
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
    insertMock,
    updateMock,
    deleteMock,
    selectFiltersMock,
    scenario,
  }
})

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { auth: authMock, from: fromMock },
}))

// The route decides which month the page is looking at.
const VIEWED_PERIOD: Period = { year: 2026, month: 3 }

const groceries: StoredOtherExpense = {
  id: "expense-1",
  concept: "Supermercado",
  amount: 85_000,
  currency: "ars",
  payment_method: "Débito",
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month,
}

const vet: StoredOtherExpense = {
  id: "expense-2",
  concept: "Veterinaria",
  amount: 40_000,
  currency: "ars",
  payment_method: null,
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month,
}

const setExpenses = (expenses: StoredOtherExpense[]) => {
  scenario.expenses = expenses
}

const renderOtherExpensesPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter
          initialEntries={[
            `/months/${VIEWED_PERIOD.year}/${VIEWED_PERIOD.month}/other`,
          ]}
        >
          <Routes>
            <Route
              path="/months/:year/:month/other"
              element={<OtherExpensesPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const rowOf = (concept: string) =>
  within(screen.getByRole("row", { name: new RegExp(concept) }))

const openCreateForm = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Agregar gasto" }))
}

const fillConceptAndAmount = (concept: string, amount: string) => {
  fireEvent.change(screen.getByLabelText("Concepto"), {
    target: { value: concept },
  })
  fireEvent.change(screen.getByLabelText("Importe"), {
    target: { value: amount },
  })
}

describe("OtherExpensesPage", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    scenario.expenses = []
    scenario.loadError = null
    scenario.writeError = null

    authMock.getSession.mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    })
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it("muestra el mes vacío sin perder el acceso a cargar un gasto", async () => {
    renderOtherExpensesPage()

    expect(
      await screen.findByText("Todavía no cargaste otros gastos para este mes.")
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Agregar gasto" })).toBeDefined()
  })

  it("lista los gastos del mes que se está viendo", async () => {
    setExpenses([
      groceries,
      { ...vet, month: VIEWED_PERIOD.month + 1, concept: "Veterinaria" },
    ])

    renderOtherExpensesPage()

    expect(await screen.findByText("Supermercado")).toBeDefined()
    expect(rowOf("Supermercado").getByText("Débito")).toBeDefined()
    expect(rowOf("Supermercado").getByText(/85\.000,00/)).toBeDefined()

    expect(selectFiltersMock).toHaveBeenCalledWith("other_expenses", {
      year: VIEWED_PERIOD.year,
      month: VIEWED_PERIOD.month,
    })
  })

  it("carga un gasto sin medio de pago en el mes que se está viendo", async () => {
    renderOtherExpensesPage()

    await openCreateForm()
    fillConceptAndAmount("Veterinaria", "40000")

    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith("other_expenses", {
        user_id: createFakeSession().user.id,
        concept: "Veterinaria",
        amount: 40_000,
        currency: "ars",
        payment_method: null,
        year: VIEWED_PERIOD.year,
        month: VIEWED_PERIOD.month,
      })
    })
  })

  it("carga un gasto en dólares con un medio de pago elegido", async () => {
    renderOtherExpensesPage()

    await openCreateForm()
    fillConceptAndAmount("Hosting", "120")

    fireEvent.click(screen.getByRole("radio", { name: "Dólares (USD)" }))
    fireEvent.click(screen.getByRole("radio", { name: "Transferencia" }))

    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "other_expenses",
        expect.objectContaining({
          concept: "Hosting",
          amount: 120,
          currency: "usd",
          payment_method: "Transferencia",
        })
      )
    })
  })

  it("guarda el texto libre cuando el medio de pago es «Otro»", async () => {
    renderOtherExpensesPage()

    await openCreateForm()
    fillConceptAndAmount("Arreglo del auto", "230000")

    fireEvent.click(screen.getByRole("radio", { name: "Otro" }))

    fireEvent.change(await screen.findByLabelText("¿Cuál?"), {
      target: { value: "Rapipago" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "other_expenses",
        expect.objectContaining({
          concept: "Arreglo del auto",
          payment_method: "Rapipago",
        })
      )
    })
  })

  it("no guarda «Otro» sin el texto del medio de pago", async () => {
    renderOtherExpensesPage()

    await openCreateForm()
    fillConceptAndAmount("Arreglo del auto", "230000")

    fireEvent.click(screen.getByRole("radio", { name: "Otro" }))
    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }))

    expect(
      await screen.findByText("Escribí con qué medio pagaste")
    ).toBeDefined()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("no guarda un gasto con importe vacío o en cero", async () => {
    renderOtherExpensesPage()

    await openCreateForm()
    fillConceptAndAmount("Veterinaria", "0")

    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }))

    expect(
      await screen.findByText("Ingresá el importe del gasto, mayor a cero")
    ).toBeDefined()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("edita un gasto conservando su mes de imputación", async () => {
    setExpenses([groceries])

    renderOtherExpensesPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Supermercado/ })
      ).findByRole("button", { name: "Editar" })
    )

    fireEvent.change(screen.getByLabelText("Importe"), {
      target: { value: "92500" },
    })
    fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }))

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        "other_expenses",
        {
          concept: "Supermercado",
          amount: 92_500,
          currency: "ars",
          payment_method: "Efectivo",
        },
        { id: "expense-1" }
      )
    })
  })

  it("elimina el gasto solo después de confirmar", async () => {
    setExpenses([groceries])

    renderOtherExpensesPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Supermercado/ })
      ).findByRole("button", { name: "Eliminar" })
    )

    expect(deleteMock).not.toHaveBeenCalled()
    expect(await screen.findByText("¿Eliminar este gasto?")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("other_expenses", {
        id: "expense-1",
      })
    })
  })

  it("muestra un error genérico sin filtrar el detalle de Supabase", async () => {
    scenario.loadError = { message: "database exploded" }

    renderOtherExpensesPage()

    expect(
      await screen.findByText(
        "No pudimos cargar los gastos del mes. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
    expect(screen.queryByText(/database exploded/)).toBeNull()
  })
})

// The same expense already loaded this month, retyped with another casing and
// stray spaces: RF-09 still considers it «muy parecido».
const openFormAndRepeatGroceries = async () => {
  await openCreateForm()
  fillConceptAndAmount("  supermercado ", "85000")
}

describe("OtherExpensesPage: carga rápida (RF-09)", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    scenario.expenses = []
    scenario.loadError = null
    scenario.writeError = null

    authMock.getSession.mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    })
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it("«Guardar y agregar otro» guarda y deja el formulario abierto y en blanco", async () => {
    renderOtherExpensesPage()

    await openCreateForm()
    fillConceptAndAmount("Veterinaria", "40000")
    fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }))

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar y agregar otro" })
    )

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "other_expenses",
        expect.objectContaining({
          concept: "Veterinaria",
          amount: 40_000,
          payment_method: "Efectivo",
        })
      )
    })

    // The form stays open, reset to its defaults: neither the concept nor the
    // payment method is dragged from the previous expense.
    await waitFor(() => {
      expect(screen.getByLabelText("Concepto")).toHaveProperty("value", "")
    })
    expect(screen.getByLabelText("Importe")).toHaveProperty("value", "")
    expect(
      screen
        .getByRole("radio", { name: "Sin especificar" })
        .getAttribute("aria-checked")
    ).toBe("true")
  })

  it("avisa del posible duplicado y no guarda nada si el usuario revisa", async () => {
    setExpenses([groceries])

    renderOtherExpensesPage()

    await openFormAndRepeatGroceries()

    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }))

    expect(await screen.findByText("¿Ya cargaste este gasto?")).toBeDefined()
    expect(
      screen.getByText(
        /Ya existe un gasto muy parecido en este mes: «Supermercado»/
      )
    ).toBeDefined()
    expect(insertMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Revisar" }))

    await waitFor(() => {
      expect(screen.queryByText("¿Ya cargaste este gasto?")).toBeNull()
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("guarda igual cuando el usuario confirma el aviso", async () => {
    setExpenses([groceries])

    renderOtherExpensesPage()

    await openFormAndRepeatGroceries()

    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }))
    fireEvent.click(await screen.findByRole("button", { name: "Cargar igual" }))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "other_expenses",
        expect.objectContaining({
          concept: "supermercado",
          amount: 85_000,
          year: VIEWED_PERIOD.year,
          month: VIEWED_PERIOD.month,
        })
      )
    })
  })

  it("no interrumpe el caso normal: otro importe no es un duplicado", async () => {
    setExpenses([groceries])

    renderOtherExpensesPage()

    await openCreateForm()
    fillConceptAndAmount("Supermercado", "90000")

    fireEvent.click(screen.getByRole("button", { name: "Guardar gasto" }))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled()
    })
    expect(screen.queryByText("¿Ya cargaste este gasto?")).toBeNull()
  })
})
