import type { Decimal } from "decimal.js"

import { convertUsdToArs, roundArs, sumArs } from "@/shared/lib/money"

/**
 * The amount side of a monthly expense as it arrives from the database: both
 * the amount and the currency may be missing, and RF-06 forbids reading either
 * one as a zero.
 */
export type ExpenseAmount = {
  amount: number | null
  currency: string | null
}

export type ExpenseLine = ExpenseAmount & {
  id: string
  concept: string
  group: string
  /** Rendered installment position, such as "3/6", when the line has one. */
  installment: string | null
}

export type ExpenseTotal = {
  totalKnownArs: Decimal
  /** False when a missing amount or a missing exchange rate left a line out. */
  isComplete: boolean
}

export type ExpenseGroupTotal = ExpenseTotal & {
  group: string
}

const isSupportedCurrency = (
  currency: string | null
): currency is "ars" | "usd" => currency === "ars" || currency === "usd"

export const computeExpenseTotal = (
  lines: readonly ExpenseAmount[],
  arsPerUsd: number | null
): ExpenseTotal => {
  const knownLines: Decimal[] = []
  let isComplete = true

  for (const line of lines) {
    if (line.amount === null || !isSupportedCurrency(line.currency)) {
      isComplete = false
      continue
    }

    if (line.currency === "ars") {
      knownLines.push(roundArs(line.amount))
      continue
    }

    if (arsPerUsd === null) {
      isComplete = false
      continue
    }

    knownLines.push(convertUsdToArs(line.amount, arsPerUsd))
  }

  return { totalKnownArs: sumArs(knownLines), isComplete }
}

/** Groups come from the stored data, so no group list is hardcoded here. */
export const computeExpenseGroupTotals = (
  lines: readonly ExpenseLine[],
  arsPerUsd: number | null
): ExpenseGroupTotal[] => {
  const groups: string[] = []

  for (const line of lines) {
    if (!groups.includes(line.group)) {
      groups.push(line.group)
    }
  }

  return groups.map((group) => ({
    group,
    ...computeExpenseTotal(
      lines.filter((line) => line.group === group),
      arsPerUsd
    ),
  }))
}

export const toArsEquivalent = (
  line: ExpenseAmount,
  arsPerUsd: number | null
): Decimal | null => {
  const { totalKnownArs, isComplete } = computeExpenseTotal([line], arsPerUsd)

  return isComplete ? totalKnownArs : null
}
