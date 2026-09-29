import { renderToBuffer } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"

import { ReportPdfDocument } from "../../components/report-pdf"
import { buildReportDocumentData } from "../../model/report-document"
import { createReportLine } from "../fixtures/report-lines"

describe("ReportPdfDocument", () => {
  it("genera un PDF con el documento armado", async () => {
    const line = createReportLine({
      id: "1",
      concept: "Hosting",
      group: "Visa",
      currency: "usd",
      amount: 100,
      year: 2026,
      month: 1,
      amountIsEstimated: true,
    })

    const data = buildReportDocumentData({
      scope: { kind: "month", period: { year: 2026, month: 1 } },
      scopeLines: [line],
      includedLines: [line],
      budgets: [
        {
          period: { year: 2026, month: 1 },
          salaryArs: 1_000_000,
          exchangeRateValue: 1_000,
          exchangeRateSource: "manual",
          exchangeRateFetchedAt: null,
        },
      ],
      source: "filtered",
      includesSalaryContext: true,
      generatedAt: new Date("2026-02-01T12:00:00Z"),
    })

    const buffer = await renderToBuffer(<ReportPdfDocument data={data} />)

    expect(buffer.length).toBeGreaterThan(0)
  })
})
