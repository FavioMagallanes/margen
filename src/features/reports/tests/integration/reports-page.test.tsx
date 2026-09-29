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
   * The real query narrows by year with gte/lte, so the mock applies the same
   * bounds: a report of one month must not receive another year's rows.
   */
  const createBuilder = (table: string) => {
    let minYear: number | null = null
    let maxYear: number | null = null

    const result = (): QueryResult => {
      if (scenario.failingTable === table) {
        return { data: null, error: { message: "database exploded" } }
      }

      const rows = rowsOf(table).filter((row) => {
        const year = (row as { year: number }).year

        return (
          (minYear === null || year >= minYear) &&
          (maxYear === null || year <= maxYear)
        )
      })

      return { data: rows, error: null }
    }

    const builder = {
      select: () => builder,
      eq: () => builder,
      gte: (_column: string, value: number) => {
        minYear = value

        return builder
      },
      lte: (_column: string, value: number) => {
        maxYear = value

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

const checkboxOf = (concept: string) =>
  screen.getByRole("checkbox", { name: new RegExp(`Seleccionar ${concept}`) })

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

  it("arranca en el mes actual y convierte cada línea con la cotización de su mes", async () => {
    renderReportsPage()

    expect(await screen.findByText("Notebook")).toBeDefined()
    expect(screen.getByText("Hosting")).toBeDefined()
    // El mes anterior no forma parte del alcance por defecto.
    expect(screen.queryByText("Netflix")).toBeNull()

    // 100 USD con la cotización guardada del mes actual (1.600).
    expect(screen.getByText(/160\.000,00/)).toBeDefined()
  })

  it("cambiar el alcance limpia la selección manual", async () => {
    renderReportsPage()

    fireEvent.click(await screen.findByRole("checkbox", { name: /Notebook/ }))

    expect(screen.getByText("1 gasto seleccionado")).toBeDefined()
    expect(checkboxOf("Notebook").getAttribute("data-checked")).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Todo el historial" }))

    // El historial completo trae también el mes anterior, y la selección
    // anterior no sobrevive al cambio de alcance.
    expect(await screen.findByText("Netflix")).toBeDefined()
    expect(screen.getByText("0 gastos seleccionados")).toBeDefined()
    expect(checkboxOf("Notebook").getAttribute("data-checked")).toBeNull()
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

  it("valida que el rango empiece antes del final y no consulta mientras es inválido", async () => {
    renderReportsPage()

    fireEvent.click(
      await screen.findByRole("button", { name: "Rango de meses" })
    )

    fireEvent.change(screen.getByLabelText("Mes desde"), {
      target: { value: "6" },
    })
    fireEvent.change(screen.getByLabelText("Mes hasta"), {
      target: { value: "2" },
    })
    fireEvent.change(screen.getByLabelText("Año hasta"), {
      target: { value: String(currentPeriod.year) },
    })
    fireEvent.change(screen.getByLabelText("Año desde"), {
      target: { value: String(currentPeriod.year) },
    })

    expect(
      screen.getByText(
        "El mes inicial del rango tiene que ser anterior o igual al final."
      )
    ).toBeDefined()
    expect(screen.queryByText("Notebook")).toBeNull()
  })

  it("descarga el PDF de los resultados filtrados, no de todo el alcance", async () => {
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
        "No pudimos cargar los gastos del alcance elegido. Intentá de nuevo en un momento."
      )
    ).toBeDefined()
    expect(screen.queryByText(/database exploded/)).toBeNull()
  })

  it("avisa cuando el alcance elegido no tiene gastos", async () => {
    scenario.occurrences = []
    scenario.otherExpenses = []

    renderReportsPage()

    expect(
      await screen.findByText(
        "No hay gastos registrados en el alcance elegido."
      )
    ).toBeDefined()
  })

  it("avisa cuando el filtro no deja ningún resultado", async () => {
    renderReportsPage()

    fireEvent.change(await screen.findByLabelText("Concepto"), {
      target: { value: "no existe" },
    })

    expect(
      await screen.findByText(
        "Ningún gasto del alcance coincide con los filtros aplicados."
      )
    ).toBeDefined()
  })
})
