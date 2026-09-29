import type { ReportExpenseLine } from "../../model/report-line"

export const createReportLine = (
  overrides: Partial<ReportExpenseLine> & Pick<ReportExpenseLine, "id">
): ReportExpenseLine => ({
  concept: "Gasto",
  group: "BBVA",
  installment: null,
  amount: 1000,
  currency: "ars",
  year: 2026,
  month: 3,
  kind: "card_purchase",
  amountIsEstimated: false,
  ...overrides,
})
