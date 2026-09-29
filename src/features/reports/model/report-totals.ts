import { Decimal } from "decimal.js"

import { toArsEquivalent } from "@/features/monthly-budget/model/expense-total"
import { sumArs } from "@/shared/lib/money"
import type { Period } from "@/shared/lib/period"

import {
  isReportCurrency,
  type ReportCurrency,
  type ReportExpenseLine,
} from "./report-line"

/**
 * RF-11: every month keeps its own saved rate, so the conversion of a
 * multi-month report is looked up per line instead of using a single global
 * value.
 */
export type ExchangeRateByPeriod = ReadonlyMap<string, number | null>

export const exchangeRateKey = ({ year, month }: Period): string =>
  `${year}-${month}`

export const exchangeRateForLine = (
  line: ReportExpenseLine,
  rates: ExchangeRateByPeriod
): number | null =>
  rates.get(exchangeRateKey({ year: line.year, month: line.month })) ?? null

export type ReportSubtotal = {
  group: string
  /** Null when the stored currency is not one this app can read (RF-06). */
  currency: ReportCurrency | null
  /** Sum in the line's own currency; null when that currency is unknown. */
  originalAmount: Decimal | null
  arsEquivalent: Decimal
  /** False when a missing amount or a missing month rate left a line out. */
  isComplete: boolean
}

export type ReportTotals = {
  subtotals: ReportSubtotal[]
  totalArs: Decimal
  isComplete: boolean
}

const UNKNOWN_CURRENCY_BUCKET = "unknown"

type SubtotalBucket = {
  group: string
  currency: ReportCurrency | null
  lines: ReportExpenseLine[]
}

const computeSubtotal = (
  bucket: SubtotalBucket,
  rates: ExchangeRateByPeriod
): ReportSubtotal => {
  const { group, currency, lines } = bucket

  if (currency === null) {
    return {
      group,
      currency,
      originalAmount: null,
      arsEquivalent: new Decimal(0),
      isComplete: false,
    }
  }

  const originals: Decimal[] = []
  const converted: Decimal[] = []
  let isComplete = true

  for (const line of lines) {
    const arsEquivalent = toArsEquivalent(
      line,
      exchangeRateForLine(line, rates)
    )

    if (line.amount === null || arsEquivalent === null) {
      isComplete = false
      continue
    }

    originals.push(new Decimal(line.amount))
    converted.push(arsEquivalent)
  }

  return {
    group,
    currency,
    originalAmount: sumArs(originals),
    arsEquivalent: sumArs(converted),
    isComplete,
  }
}

/**
 * Subtotals by group and currency, plus the ARS equivalent of everything
 * included. Only the given lines are added up: a partial export never shows
 * the total of the whole scope.
 */
export const computeReportTotals = (
  lines: readonly ReportExpenseLine[],
  rates: ExchangeRateByPeriod
): ReportTotals => {
  const buckets = new Map<string, SubtotalBucket>()

  for (const line of lines) {
    const currency = isReportCurrency(line.currency) ? line.currency : null
    const key = `${line.group}::${currency ?? UNKNOWN_CURRENCY_BUCKET}`
    const bucket = buckets.get(key)

    if (bucket === undefined) {
      buckets.set(key, { group: line.group, currency, lines: [line] })
      continue
    }

    bucket.lines.push(line)
  }

  const subtotals = [...buckets.values()].map((bucket) =>
    computeSubtotal(bucket, rates)
  )

  return {
    subtotals,
    totalArs: sumArs(subtotals.map((subtotal) => subtotal.arsEquivalent)),
    isComplete: subtotals.every((subtotal) => subtotal.isComplete),
  }
}
