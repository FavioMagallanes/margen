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
import type { Period } from "@/shared/lib/period"

type StoredOccurrence = {
  id: string
  plan_id: string
  year: number
  month: number
  amount: number | null
  installment_number: number | null
  spending_plans: {
    id: string
    concept: string
    group_label: string
    total_installments: number | null
    kind: string
    currency: string
  }
}

const { authMock, fromMock, rpcMock, deleteMock, selectFiltersMock, scenario } =
  vi.hoisted(() => {
    type QueryResult = { data: unknown; error: { message: string } | null }

    type Occurrence = {
      year: number
      month: number
      amount: number | null
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
      let wantsMissingAmount = false

      const result = (): QueryResult => {
        if (isDelete) {
          deleteMock(table, filters)

          return { data: null, error: scenario.deleteError }
        }

        if (scenario.loadError !== null) {
          return { data: null, error: scenario.loadError }
        }

        // The budget reads its salary and its one-off expenses elsewhere;
        // this suite only cares about the loans of the month.
        if (table === "monthly_budgets") {
          return { data: null, error: null }
        }

        if (table === "other_expenses") {
          return { data: [], error: null }
        }

        selectFiltersMock(table, filters, { missingAmount: wantsMissingAmount })

        // The real query filters the embedded plan with "!inner"; the mock
        // applies the same filter so a missing one would show other kinds.
        const kindFilter = filters["spending_plans.kind"]
        const rows = scenario.occurrences.filter((occurrence) => {
          if (
            kindFilter !== undefined &&
            occurrence.spending_plans.kind !== kindFilter
          ) {
            return false
          }

          if (wantsMissingAmount) {
            return occurrence.amount === null
          }

          return (
            (filters.year === undefined || occurrence.year === filters.year) &&
            (filters.month === undefined || occurrence.month === filters.month)
          )
        })

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
        is: (column: string, value: unknown) => {
          wantsMissingAmount = column === "amount" && value === null

          return builder
        },
        order: () => builder,
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

// The route decides which month the page is looking at.
const VIEWED_PERIOD: Period = { year: 2026, month: 3 }

const bankLoanPlan = {
  id: "plan-1",
  concept: "Préstamo personal",
  group_label: "BBVA",
  total_installments: 12,
  kind: "loan",
  // The loans query never reads the currency (a loan is always in ARS), but
  // the month summary does, so the stored row carries it.
  currency: "ars",
}

const currentInstallment: StoredOccurrence = {
  id: "occurrence-1",
  plan_id: "plan-1",
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month,
  amount: 120_000,
  installment_number: 4,
  spending_plans: bankLoanPlan,
}

const nextInstallment: StoredOccurrence = {
  id: "occurrence-2",
  plan_id: "plan-1",
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month + 1,
  amount: null,
  installment_number: 5,
  spending_plans: bankLoanPlan,
}

const laterInstallment: StoredOccurrence = {
  id: "occurrence-3",
  plan_id: "plan-1",
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month + 2,
  amount: null,
  installment_number: 6,
  spending_plans: bankLoanPlan,
}

// Same installment as currentInstallment, but still missing its amount: a
// month that already happened without one is what makes the subtotal
// incomplete, unlike a future installment that has not been completed yet.
const currentInstallmentMissingAmount: StoredOccurrence = {
  ...currentInstallment,
  amount: null,
}

const cardInstallment: StoredOccurrence = {
  id: "occurrence-4",
  plan_id: "plan-2",
  year: VIEWED_PERIOD.year,
  month: VIEWED_PERIOD.month,
  amount: 45_000,
  installment_number: 2,
  spending_plans: {
    id: "plan-2",
    concept: "Notebook",
    group_label: "BBVA",
    total_installments: 6,
    kind: "card_purchase",
    currency: "ars",
  },
}

const setOccurrences = (occurrences: StoredOccurrence[]) => {
  scenario.occurrences = occurrences
}

const renderBudgetPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter
          initialEntries={[
            `/months/${VIEWED_PERIOD.year}/${VIEWED_PERIOD.month}`,
          ]}
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
const openLoanForm = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Agregar gasto" }))
  fireEvent.click(await screen.findByRole("button", { name: "Préstamo" }))

  // The form waits for the loans of the month before opening (RF-09).
  await screen.findByLabelText("Concepto")
}

const rowOf = (concept: string) =>
  within(screen.getByRole("row", { name: new RegExp(concept) }))

describe("préstamos desde Presupuesto", () => {
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

  it("muestra el mes vacío sin perder el acceso a cargar un préstamo", async () => {
    renderBudgetPage()

    expect(
      await screen.findByText("Todavía no cargaste gastos para este mes.")
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Agregar gasto" })).toBeDefined()
  })

  it("muestra la cuota del mes y consulta solo los préstamos al abrir el formulario", async () => {
    setOccurrences([currentInstallment, cardInstallment])

    renderBudgetPage()

    expect(await screen.findByText("Préstamo personal")).toBeDefined()
    expect(rowOf("Préstamo personal").getByText("4/12")).toBeDefined()
    expect(rowOf("Préstamo personal").getByText(/120\.000,00/)).toBeDefined()

    await openLoanForm()

    expect(selectFiltersMock).toHaveBeenCalledWith(
      "expense_occurrences",
      {
        year: VIEWED_PERIOD.year,
        month: VIEWED_PERIOD.month,
        "spending_plans.kind": "loan",
      },
      { missingAmount: false }
    )
  })

  it("crea un préstamo en el mes que se está viendo", async () => {
    renderBudgetPage()

    await openLoanForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Préstamo personal" },
    })
    fireEvent.change(screen.getByLabelText("Entidad"), {
      target: { value: "Banco Nación" },
    })
    fireEvent.change(screen.getByLabelText("Importe de la cuota (ARS)"), {
      target: { value: "120000" },
    })
    fireEvent.change(screen.getByLabelText("Cuota que se carga"), {
      target: { value: "4" },
    })
    fireEvent.change(screen.getByLabelText("Total de cuotas"), {
      target: { value: "12" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar préstamo" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("create_loan", {
        p_concept: "Préstamo personal",
        p_entity: "Banco Nación",
        p_starting_installment: 4,
        p_total_installments: 12,
        p_year: VIEWED_PERIOD.year,
        p_month: VIEWED_PERIOD.month,
        p_quota_amount: 120_000,
      })
    })
  })

  it("no deja guardar una cuota inicial mayor al total de cuotas", async () => {
    renderBudgetPage()

    await openLoanForm()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "Préstamo personal" },
    })
    fireEvent.change(screen.getByLabelText("Entidad"), {
      target: { value: "BBVA" },
    })
    fireEvent.change(screen.getByLabelText("Importe de la cuota (ARS)"), {
      target: { value: "120000" },
    })
    fireEvent.change(screen.getByLabelText("Cuota que se carga"), {
      target: { value: "13" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar préstamo" }))

    expect(
      await screen.findByText(
        "La cuota inicial no puede superar el total de cuotas"
      )
    ).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("edita el préstamo desde la cuota del mes sin tocar ningún importe", async () => {
    setOccurrences([currentInstallment, nextInstallment])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Editar" })
    )

    fireEvent.change(await screen.findByLabelText("Entidad"), {
      target: { value: "Mercado Pago" },
    })
    fireEvent.change(screen.getByLabelText("Total de cuotas"), {
      target: { value: "18" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("update_loan", {
        p_plan_id: "plan-1",
        p_concept: "Préstamo personal",
        p_entity: "Mercado Pago",
        p_from_installment: 4,
        p_from_year: VIEWED_PERIOD.year,
        p_from_month: VIEWED_PERIOD.month,
        p_total_installments: 18,
      })
    })

    // The exact-argument assertion above is what proves the reschedule carries
    // no amount: the amounts already entered for other installments have to
    // survive the edit (RF-03).
    expect(rpcMock).not.toHaveBeenCalledWith(
      "update_loan",
      expect.objectContaining({ p_quota_amount: expect.anything() })
    )
  })

  it("edita el importe de la cuota abierta sin tocar las demás", async () => {
    setOccurrences([currentInstallment, nextInstallment])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Editar" })
    )

    const amountField = await screen.findByLabelText("Importe de esta cuota")

    expect((amountField as HTMLInputElement).value).toBe("120.000,00")

    fireEvent.change(amountField, { target: { value: "135000" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("set_loan_installment_amounts", {
        p_items: [{ occurrence_id: "occurrence-1", amount: 135_000 }],
      })
    })
    expect(rpcMock).toHaveBeenCalledWith("update_loan", expect.anything())
  })

  it("no guarda ningún importe si el campo queda vacío", async () => {
    setOccurrences([currentInstallmentMissingAmount])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Editar" })
    )

    const amountField = await screen.findByLabelText("Importe de esta cuota")

    expect((amountField as HTMLInputElement).value).toBe("")

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("update_loan", expect.anything())
    })
    expect(rpcMock).not.toHaveBeenCalledWith(
      "set_loan_installment_amounts",
      expect.anything()
    )
  })

  it("no deja reducir el total por debajo de la cuota que se está editando", async () => {
    setOccurrences([currentInstallment])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Editar" })
    )

    fireEvent.change(await screen.findByLabelText("Total de cuotas"), {
      target: { value: "2" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

    expect(
      await screen.findByText(
        "El total de cuotas no puede ser menor a la cuota que estás editando"
      )
    ).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("completa en lote las cuotas futuras sin importe", async () => {
    setOccurrences([currentInstallment, nextInstallment, laterInstallment])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Completar próximas cuotas" })
    )

    const nextAmountField = await screen.findByLabelText(
      /Importe de la cuota 5/
    )
    const laterAmountField = screen.getByLabelText(/Importe de la cuota 6/)

    fireEvent.change(nextAmountField, { target: { value: "117500" } })
    fireEvent.change(laterAmountField, { target: { value: "115000" } })

    fireEvent.click(screen.getByRole("button", { name: "Guardar importes" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("set_loan_installment_amounts", {
        p_items: [
          { occurrence_id: "occurrence-2", amount: 117_500 },
          { occurrence_id: "occurrence-3", amount: 115_000 },
        ],
      })
    })
  })

  it("deja de ofrecer completar cuotas cuando el préstamo ya no tiene pendientes", async () => {
    setOccurrences([currentInstallment])

    renderBudgetPage()

    expect(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Editar" })
    ).toBeDefined()

    expect(
      within(
        screen.getByRole("row", { name: /Préstamo personal/ })
      ).queryByRole("button", { name: "Completar próximas cuotas" })
    ).toBeNull()
  })

  it("no guarda el lote si todas las cuotas quedaron vacías", async () => {
    setOccurrences([currentInstallment, nextInstallment])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Completar próximas cuotas" })
    )

    fireEvent.click(
      await screen.findByRole("button", { name: "Guardar importes" })
    )

    expect(
      await screen.findByText(
        "Completá al menos un importe para poder guardar."
      )
    ).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("avisa cuántas cuotas ya vencidas siguen sin importe", async () => {
    setOccurrences([currentInstallmentMissingAmount, nextInstallment])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Completar próximas cuotas" })
    )

    // La cuota de marzo (mes visto) ya venció y sigue sin importe; la de
    // abril todavía no, así que no cuenta para el aviso.
    expect(
      await screen.findByText(
        "Subtotal incompleto: hay 1 cuota sin importe en este préstamo hasta el mes que estás viendo."
      )
    ).toBeDefined()
  })

  it("muestra «Sin dato» y avisa que el total del grupo está incompleto", async () => {
    setOccurrences([{ ...currentInstallment, amount: null }, nextInstallment])

    renderBudgetPage()

    expect(
      await screen.findByRole("row", { name: /Préstamo personal/ })
    ).toBeDefined()
    expect(rowOf("Préstamo personal").getByText("Sin dato")).toBeDefined()

    // RF-03: a missing amount is not a zero expense, so the month says its
    // total is incomplete instead of pretending to be exact.
    expect(
      screen.getByText("Total incompleto: faltan datos de este grupo.")
    ).toBeDefined()
  })

  it("elimina el préstamo solo después de confirmar", async () => {
    setOccurrences([currentInstallment])

    renderBudgetPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Eliminar" })
    )

    expect(deleteMock).not.toHaveBeenCalled()
    expect(await screen.findByText("¿Eliminar este préstamo?")).toBeDefined()

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

type LoanFields = {
  concept: string
  entity: string
  quotaAmount: string
  startingInstallment: string
  totalInstallments: string
}

const fillLoan = ({
  concept,
  entity,
  quotaAmount,
  startingInstallment,
  totalInstallments,
}: LoanFields) => {
  fireEvent.change(screen.getByLabelText("Concepto"), {
    target: { value: concept },
  })
  fireEvent.change(screen.getByLabelText("Entidad"), {
    target: { value: entity },
  })
  fireEvent.change(screen.getByLabelText("Importe de la cuota (ARS)"), {
    target: { value: quotaAmount },
  })
  fireEvent.change(screen.getByLabelText("Cuota que se carga"), {
    target: { value: startingInstallment },
  })
  fireEvent.change(screen.getByLabelText("Total de cuotas"), {
    target: { value: totalInstallments },
  })
}

// The very installment already loaded this month, retyped with another
// casing: RF-09 still considers it «muy parecido».
const openFormAndRepeatCurrentInstallment = async () => {
  await openLoanForm()

  fillLoan({
    concept: "préstamo personal",
    entity: "BBVA",
    quotaAmount: "120000",
    startingInstallment: "4",
    totalInstallments: "12",
  })
}

describe("préstamos desde Presupuesto: carga rápida (RF-09)", () => {
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
    renderBudgetPage()

    await openLoanForm()

    fillLoan({
      concept: "Préstamo personal",
      entity: "Banco Nación",
      quotaAmount: "120000",
      startingInstallment: "4",
      totalInstallments: "12",
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Guardar y agregar otro" })
    )

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_loan",
        expect.objectContaining({
          p_concept: "Préstamo personal",
          p_entity: "Banco Nación",
          p_starting_installment: 4,
        })
      )
    })

    // The form stays open, reset to its defaults: nothing is dragged from the
    // previous loan, not even the installment number.
    await waitFor(() => {
      expect(screen.getByLabelText("Concepto")).toHaveProperty("value", "")
    })
    expect(screen.getByLabelText("Entidad")).toHaveProperty("value", "")
    expect(screen.getByLabelText("Importe de la cuota (ARS)")).toHaveProperty(
      "value",
      ""
    )
    expect(screen.getByLabelText("Cuota que se carga")).toHaveProperty(
      "value",
      "1"
    )
  })

  it("avisa del posible duplicado y no guarda nada si el usuario revisa", async () => {
    setOccurrences([currentInstallment])

    renderBudgetPage()

    await openFormAndRepeatCurrentInstallment()

    fireEvent.click(screen.getByRole("button", { name: "Guardar préstamo" }))

    expect(await screen.findByText("¿Ya cargaste este préstamo?")).toBeDefined()
    expect(
      screen.getByText(
        /Ya existe un gasto muy parecido: «Préstamo personal» de BBVA/
      )
    ).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Revisar" }))

    await waitFor(() => {
      expect(screen.queryByText("¿Ya cargaste este préstamo?")).toBeNull()
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("guarda igual cuando el usuario confirma el aviso", async () => {
    setOccurrences([currentInstallment])

    renderBudgetPage()

    await openFormAndRepeatCurrentInstallment()

    fireEvent.click(screen.getByRole("button", { name: "Guardar préstamo" }))
    fireEvent.click(await screen.findByRole("button", { name: "Cargar igual" }))

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_loan",
        expect.objectContaining({
          p_concept: "préstamo personal",
          p_entity: "BBVA",
          p_quota_amount: 120_000,
          p_starting_installment: 4,
        })
      )
    })
  })
})
