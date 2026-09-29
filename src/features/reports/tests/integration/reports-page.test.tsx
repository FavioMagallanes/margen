import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { createFakeSession } from "@/features/auth/tests/fixtures/session"
import { ReportsPage } from "@/features/reports/components/reports-page"
import type { ReportDocumentData } from "@/features/reports/model/report-document"
import { addMonths, getCurrentPeriod } from "@/shared/lib/period"

const downloadReportPdfMock =
  vi.fn<(data: ReportDocumentData) => Promise<void>>()

// La generación real del PDF no aporta nada acá: lo que importa es qué datos
// recibe la descarga en cada botón.
vi.mock("@/features/reports/components/report-pdf-download", () => ({
  downloadReportPdf: (data: ReportDocumentData) => downloadReportPdfMock(data),
}))

const { authMock, fromMock, scenario } = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: { message: string } | null }

  const scenario = {
    occurrences: [] as unknown[],
    otherExpenses: [] as unknown[],
    budgets: [] as unknown[],
    failingTable: null as string | null,
  }

  const rowsOf = (table: string): unknown[] => {
    if (table === "expense_occurrences") {
      return scenario.occurrences
    }

    if (table === "other_expenses") {
      return scenario.otherExpenses
    }

    return scenario.budgets
  }

  /**
   * The real query filters the exact (year, month) pair with eq, so the mock
   * applies the same equality: a report never receives another month's rows.
   */
  const createBuilder = (table: string) => {
    const equals = new Map<string, unknown>()

    const result = (): QueryResult => {
      if (scenario.failingTable === table) {
        return { data: null, error: { message: "database exploded" } }
      }

      const rows = rowsOf(table).filter((row) =>
        [...equals].every(([column, value]) => {
          const cell = (row as Record<string, unknown>)[column]

          return cell === undefined || cell === value
        })
      )

      return { data: rows, error: null }
    }

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        equals.set(column, value)

        return builder
      },
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

const currentPeriod = getCurrentPeriod()
const previousPeriod = addMonths(currentPeriod, -1)

const renderReportsPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ReportsPage />
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe("ReportsPage", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    downloadReportPdfMock.mockResolvedValue(undefined)
    scenario.failingTable = null
    scenario.occurrences = [
      {
        id: "occurrence-1",
        amount: 45_000,
        amount_is_estimated: false,
        installment_number: 3,
        year: currentPeriod.year,
        month: currentPeriod.month,
        spending_plans: {
          concept: "Notebook",
          group_label: "BBVA",
          currency: "ars",
          total_installments: 6,
          kind: "card_purchase",
        },
      },
      {
        id: "occurrence-2",
        amount: 9_000,
        amount_is_estimated: true,
        installment_number: null,
        year: previousPeriod.year,
        month: previousPeriod.month,
        spending_plans: {
          concept: "Netflix",
          group_label: "Visa",
          currency: "ars",
          total_installments: null,
          kind: "recurring",
        },
      },
    ]
    scenario.otherExpenses = [
      {
        id: "other-1",
        concept: "Hosting",
        amount: 100,
        currency: "usd",
        year: currentPeriod.year,
        month: currentPeriod.month,
      },
    ]
    scenario.budgets = [
      {
        year: currentPeriod.year,
        month: currentPeriod.month,
        salary_ars: 1_800_000,
        exchange_rate_value: 1_600,
        exchange_rate_source: "manual",
        exchange_rate_fetched_at: null,
      },
      {
        year: previousPeriod.year,
        month: previousPeriod.month,
        salary_ars: 1_500_000,
        exchange_rate_value: 1_000,
        exchange_rate_source: "manual",
        exchange_rate_fetched_at: null,
      },
    ]

    authMock.getSession.mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    })
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it("consulta solo el mes actual y convierte cada línea con su cotización", async () => {
    renderReportsPage()

    expect(await screen.findByText("Notebook")).toBeDefined()
    expect(screen.getByText("Hosting")).toBeDefined()
    // El reporte es siempre el mes actual: el mes anterior no entra.
    expect(screen.queryByText("Netflix")).toBeNull()

    // 100 USD con la cotización guardada del mes actual (1.600).
    expect(screen.getByText(/160\.000,00/)).toBeDefined()
  })

  it("aplicar un filtro no pierde la selección y avisa de lo que quedó fuera", async () => {
    renderReportsPage()

    fireEvent.click(await screen.findByRole("checkbox", { name: /Notebook/ }))
    fireEvent.click(screen.getByRole("checkbox", { name: /Hosting/ }))

    expect(screen.getByText("2 gastos seleccionados")).toBeDefined()

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "notebook" },
    })

    await waitFor(() => {
      expect(screen.queryByText("Hosting")).toBeNull()
    })

    // Filtrar recorta la vista, nunca la selección.
    expect(screen.getByText("2 gastos seleccionados")).toBeDefined()
    expect(
      screen.getByText("1 gasto seleccionado no aparece con el filtro actual.")
    ).toBeDefined()

    fireEvent.click(
      screen.getByRole("button", { name: "Ver la selección completa" })
    )

    expect(await screen.findByText("Hosting")).toBeDefined()
  })

  it("selecciona todos los resultados del filtro actual y los limpia", async () => {
    renderReportsPage()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Seleccionar todos los resultados del filtro actual",
      })
    )

    expect(screen.getByText("2 gastos seleccionados")).toBeDefined()
    // 45.000 en ARS + 100 USD a 1.600 del mes actual.
    expect(screen.getByText(/205\.000,00/)).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Limpiar selección" }))

    expect(screen.getByText("0 gastos seleccionados")).toBeDefined()
  })

  it("descarga el PDF de los resultados filtrados, no de todo el mes", async () => {
    renderReportsPage()

    fireEvent.change(await screen.findByLabelText("Concepto"), {
      target: { value: "notebook" },
    })

    await waitFor(() => {
      expect(screen.queryByText("Hosting")).toBeNull()
    })

    fireEvent.click(
      screen.getByRole("button", {
        name: "Descargar PDF de los resultados filtrados",
      })
    )

    await waitFor(() => {
      expect(downloadReportPdfMock).toHaveBeenCalledTimes(1)
    })

    const data = downloadReportPdfMock.mock.calls[0]?.[0]

    expect(data?.source).toBe("filtered")
    expect(data?.isPartial).toBe(true)
    expect(data?.lines.map(({ line }) => line.id)).toEqual(["occurrence-1"])
    // 45.000 ARS de la única línea filtrada, sin el USD que quedó afuera.
    expect(data?.totals.totalArs.toString()).toBe("45000")
  })

  it("descarga el PDF de la selección sin importar el filtro vigente", async () => {
    renderReportsPage()

    fireEvent.click(await screen.findByRole("checkbox", { name: /Hosting/ }))

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "notebook" },
    })

    await waitFor(() => {
      expect(screen.queryByText("Hosting")).toBeNull()
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Descargar PDF de la selección" })
    )

    await waitFor(() => {
      expect(downloadReportPdfMock).toHaveBeenCalledTimes(1)
    })

    const data = downloadReportPdfMock.mock.calls[0]?.[0]

    expect(data?.source).toBe("selection")
    expect(data?.lines.map(({ line }) => line.id)).toEqual(["other-1"])
  })

  it("no exporta la selección mientras no haya ningún gasto marcado", async () => {
    renderReportsPage()

    const selectionExport = await screen.findByRole("button", {
      name: "Descargar PDF de la selección",
    })

    expect(selectionExport.hasAttribute("disabled")).toBe(true)
    expect(
      screen.getByText(
        "Seleccioná al menos un gasto para exportar la selección."
      )
    ).toBeDefined()
  })

  it("no mezcla el contexto de sueldo cuando la exportación es parcial", async () => {
    renderReportsPage()

    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Incluir sueldo y disponible",
      })
    )

    fireEvent.change(screen.getByLabelText("Concepto"), {
      target: { value: "notebook" },
    })

    await waitFor(() => {
      expect(screen.queryByText("Hosting")).toBeNull()
    })

    fireEvent.click(
      screen.getByRole("button", {
        name: "Descargar PDF de los resultados filtrados",
      })
    )

    await waitFor(() => {
      expect(downloadReportPdfMock).toHaveBeenCalledTimes(1)
    })

    expect(downloadReportPdfMock.mock.calls[0]?.[0]?.salaryContext).toEqual([])
  })

  it("avisa si la generación del PDF falla", async () => {
    downloadReportPdfMock.mockRejectedValue(new Error("pdf exploded"))

    renderReportsPage()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Descargar PDF de los resultados filtrados",
      })
    )

    expect(
      await screen.findByText(
        "No pudimos generar el PDF. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
    expect(screen.queryByText(/pdf exploded/)).toBeNull()
  })

  it("muestra un error genérico sin filtrar el detalle de Supabase", async () => {
    scenario.failingTable = "expense_occurrences"

    renderReportsPage()

    expect(
      await screen.findByText(
        "No pudimos cargar los gastos del mes. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
    expect(screen.queryByText(/database exploded/)).toBeNull()
  })

  it("avisa cuando el mes actual no tiene gastos", async () => {
    scenario.occurrences = []
    scenario.otherExpenses = []

    renderReportsPage()

    expect(
      await screen.findByText("No hay gastos registrados este mes.")
    ).toBeDefined()
  })

  it("avisa cuando el filtro no deja ningún resultado", async () => {
    renderReportsPage()

    fireEvent.change(await screen.findByLabelText("Concepto"), {
      target: { value: "no existe" },
    })

    expect(
      await screen.findByText(
        "Ningún gasto del mes coincide con los filtros aplicados."
      )
    ).toBeDefined()
  })
})
