import { Decimal } from "decimal.js"

import {
  computeExpenseTotal,
  toArsEquivalent,
} from "@/features/monthly-budget/model/expense-total"
import type { Period } from "@/shared/lib/period"

import type { ReportMonthlyBudget } from "../api/report-queries"
import type { ReportExpenseLine } from "./report-line"
import { type ReportScope, scopeCacheKey } from "./report-scope"
import {
  computeReportTotals,
  type ExchangeRateByPeriod,
  exchangeRateForLine,
  exchangeRateKey,
  type ReportTotals,
} from "./report-totals"

/**
 * RF-11 offers two exports, and the document has to say which one produced it:
 * the results the filters left on screen, or the manual selection.
 */
export type ReportExportSource = "filtered" | "selection"

export type ReportWarning =
  "estimated_amounts" | "incomplete_data" | "reference_exchange_rate"

export type ReportDocumentLine = {
  line: ReportExpenseLine
  /** Only USD lines get one; null when the month has no saved rate. */
  arsEquivalent: Decimal | null
}

/** The rate of one month as it was saved, never re-fetched to export. */
export type ReportDocumentMonth = {
  period: Period
  exchangeRateValue: number | null
  exchangeRateSource: string | null
  exchangeRateFetchedAt: string | null
}

/**
 * Salary and available of a month included whole. A month exported partially
 * never gets one: the context of a full month must not read as the total of a
 * recortada export.
 */
export type ReportSalaryContext = {
  period: Period
  salaryArs: number | null
  monthExpensesArs: Decimal
  availableArs: Decimal | null
  isComplete: boolean
}

export type ReportDocumentData = {
  scope: ReportScope
  generatedAt: Date
  source: ReportExportSource
  /** True when the export leaves out lines the chosen scope does contain. */
  isPartial: boolean
  lines: ReportDocumentLine[]
  months: ReportDocumentMonth[]
  totals: ReportTotals
  salaryContext: ReportSalaryContext[]
  warnings: ReportWarning[]
}

export type ReportDocumentInput = {
  scope: ReportScope
  /** Everything the chosen scope holds, needed to detect a partial export. */
  scopeLines: readonly ReportExpenseLine[]
  /** Exactly the lines this export includes. */
  includedLines: readonly ReportExpenseLine[]
  budgets: readonly ReportMonthlyBudget[]
  source: ReportExportSource
  includesSalaryContext: boolean
  generatedAt: Date
}

const ratesOf = (
  budgets: readonly ReportMonthlyBudget[]
): ExchangeRateByPeriod =>
  new Map(
    budgets.map((budget) => [
      exchangeRateKey(budget.period),
      budget.exchangeRateValue,
    ])
  )

const periodsOf = (lines: readonly ReportExpenseLine[]): Period[] => {
  const periods = new Map<string, Period>()

  for (const line of lines) {
    const period = { year: line.year, month: line.month }
    periods.set(exchangeRateKey(period), period)
  }

  return [...periods.values()].sort(
    (left, right) => left.year - right.year || left.month - right.month
  )
}

const linesOfPeriod = (
  lines: readonly ReportExpenseLine[],
  period: Period
): ReportExpenseLine[] =>
  lines.filter(
    (line) => line.year === period.year && line.month === period.month
  )

/**
 * A month only carries its salary context when the export covers it whole: a
 * filter or a selection that leaves lines out makes the monthly summary
 * incomparable with what is being exported.
 */
const buildSalaryContext = (
  input: ReportDocumentInput,
  rates: ExchangeRateByPeriod
): ReportSalaryContext[] => {
  if (!input.includesSalaryContext) {
    return []
  }

  const includedIds = new Set(input.includedLines.map((line) => line.id))

  return periodsOf(input.includedLines)
    .filter((period) => {
      const monthLines = linesOfPeriod(input.scopeLines, period)

      return (
        monthLines.length > 0 &&
        monthLines.every((line) => includedIds.has(line.id))
      )
    })
    .map((period) => {
      const monthLines = linesOfPeriod(input.scopeLines, period)
      const rate = rates.get(exchangeRateKey(period)) ?? null
      const { totalKnownArs, isComplete } = computeExpenseTotal(
        monthLines,
        rate
      )
      const salaryArs =
        input.budgets.find(
          (budget) =>
            budget.period.year === period.year &&
            budget.period.month === period.month
        )?.salaryArs ?? null

      return {
        period,
        salaryArs,
        monthExpensesArs: totalKnownArs,
        availableArs:
          salaryArs === null
            ? null
            : new Decimal(salaryArs).minus(totalKnownArs),
        isComplete: isComplete && salaryArs !== null,
      }
    })
}

const buildWarnings = (
  lines: readonly ReportDocumentLine[],
  totals: ReportTotals
): ReportWarning[] => {
  const warnings: ReportWarning[] = []

  if (lines.some(({ line }) => line.amountIsEstimated)) {
    warnings.push("estimated_amounts")
  }

  if (lines.some(({ line }) => line.currency === "usd")) {
    warnings.push("reference_exchange_rate")
  }

  if (!totals.isComplete) {
    warnings.push("incomplete_data")
  }

  return warnings
}

/**
 * Everything the PDF shows, decided without rendering anything: the document
 * component only formats and lays out this data.
 */
export const buildReportDocumentData = (
  input: ReportDocumentInput
): ReportDocumentData => {
  const rates = ratesOf(input.budgets)

  const lines: ReportDocumentLine[] = input.includedLines.map((line) => ({
    line,
    arsEquivalent:
      line.currency === "usd"
        ? toArsEquivalent(line, exchangeRateForLine(line, rates))
        : null,
  }))

  const months: ReportDocumentMonth[] = periodsOf(input.includedLines).map(
    (period) => {
      const budget = input.budgets.find(
        (candidate) =>
          candidate.period.year === period.year &&
          candidate.period.month === period.month
      )

      return {
        period,
        exchangeRateValue: budget?.exchangeRateValue ?? null,
        exchangeRateSource: budget?.exchangeRateSource ?? null,
        exchangeRateFetchedAt: budget?.exchangeRateFetchedAt ?? null,
      }
    }
  )

  // Only the included lines are added up: a partial export never shows the
  // total of the whole scope.
  const totals = computeReportTotals(input.includedLines, rates)

  return {
    scope: input.scope,
    generatedAt: input.generatedAt,
    source: input.source,
    isPartial: input.includedLines.length < input.scopeLines.length,
    lines,
    months,
    totals,
    salaryContext: buildSalaryContext(input, rates),
    warnings: buildWarnings(lines, totals),
  }
}

/** Colons would be an invalid file name on Windows, so the key is flattened. */
export const reportFileName = (scope: ReportScope): string =>
  `margen-reporte-${scopeCacheKey(scope).replaceAll(":", "-")}.pdf`
