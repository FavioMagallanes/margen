import type { ExpenseLine } from "@/features/monthly-budget/model/expense-total"
import type { Period } from "@/shared/lib/period"

/**
 * Where the line comes from. `other` is not a `spending_plans.kind`: other
 * expenses have no plan, so the report labels them explicitly.
 */
export type ReportExpenseKind = "card_purchase" | "loan" | "recurring" | "other"

export type ReportCurrency = "ars" | "usd"

/**
 * A month expense seen from a report: the same line the monthly budget shows,
 * plus the month it belongs to (implicit there, essential across months) and
 * its kind (needed by the RF-10 filter).
 */
export type ReportExpenseLine = ExpenseLine & {
  year: number
  month: number
  kind: ReportExpenseKind
}

export const linePeriod = (line: ReportExpenseLine): Period => ({
  year: line.year,
  month: line.month,
})

export const REPORT_KIND_LABELS: Record<ReportExpenseKind, string> = {
  card_purchase: "Tarjeta",
  loan: "Préstamo",
  recurring: "Recurrente",
  other: "Otro",
}

export const REPORT_CURRENCY_LABELS: Record<ReportCurrency, string> = {
  ars: "ARS",
  usd: "USD",
}

export const isReportCurrency = (
  currency: string | null
): currency is ReportCurrency => currency === "ars" || currency === "usd"
