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
import { LoansPage } from "@/features/loans/components/loans-page"
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
  },
}

const setOccurrences = (occurrences: StoredOccurrence[]) => {
  scenario.occurrences = occurrences
}

const renderLoansPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter
          initialEntries={[
            `/months/${VIEWED_PERIOD.year}/${VIEWED_PERIOD.month}/loans`,
          ]}
        >
          <Routes>
            <Route path="/months/:year/:month/loans" element={<LoansPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const rowOf = (concept: string) =>
  within(screen.getByRole("row", { name: new RegExp(concept) }))

describe("LoansPage", () => {
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
    renderLoansPage()

    expect(
      await screen.findByText("Todavía no cargaste préstamos para este mes.")
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: "Agregar préstamo" })
    ).toBeDefined()
  })

  it("agrupa por entidad, marca la cuota del mes y deja fuera otros planes", async () => {
    setOccurrences([currentInstallment, cardInstallment])

    renderLoansPage()

    expect(await screen.findByText("Préstamo personal")).toBeDefined()
    expect(screen.queryByText("Notebook")).toBeNull()
    expect(rowOf("Préstamo personal").getByText("4/12")).toBeDefined()
    expect(rowOf("Préstamo personal").getByText(/120\.000,00/)).toBeDefined()

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
    renderLoansPage()

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar préstamo" })
    )

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
    renderLoansPage()

    fireEvent.click(
      await screen.findByRole("button", { name: "Agregar préstamo" })
    )

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

    renderLoansPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Editar" })
    )

    fireEvent.change(screen.getByLabelText("Entidad"), {
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

  it("no deja reducir el total por debajo de la cuota que se está editando", async () => {
    setOccurrences([currentInstallment])

    renderLoansPage()

    fireEvent.click(
      await within(
        await screen.findByRole("row", { name: /Préstamo personal/ })
      ).findByRole("button", { name: "Editar" })
    )

    fireEvent.change(screen.getByLabelText("Total de cuotas"), {
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

    renderLoansPage()

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

  it("no guarda el lote si todas las cuotas quedaron vacías", async () => {
    setOccurrences([currentInstallment, nextInstallment])

    renderLoansPage()

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

  it("muestra «Falta completar importe» y avisa que el subtotal está incompleto", async () => {
    setOccurrences([{ ...currentInstallment, amount: null }, nextInstallment])

    renderLoansPage()

    expect(
      await screen.findByRole("row", { name: /Préstamo personal/ })
    ).toBeDefined()
    expect(
      rowOf("Préstamo personal").getByText("Falta completar importe")
    ).toBeDefined()

    // Only the installment of this month counts as missing: the next one is
    // still in the future.
    expect(
      await screen.findByText(
        /Subtotal incompleto: hay 1 cuota sin importe en este mes o en meses anteriores/
      )
    ).toBeDefined()
  })

  it("elimina el préstamo solo después de confirmar", async () => {
    setOccurrences([currentInstallment])

    renderLoansPage()

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

    renderLoansPage()

    expect(
      await screen.findByText(
        "No pudimos cargar los préstamos del mes. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
    expect(screen.queryByText(/database exploded/)).toBeNull()
  })
})
