import type { ExpenseLine } from "@/features/monthly-budget/model/expense-total"

/**
 * A committed month line. Only card purchase installments reach this view: an
 * unplanned expense commits no future month.
 */
export type UpcomingExpenseLine = ExpenseLine & {
  /** RF-05: a variable amount carried over from another month is estimated. */
  amountIsEstimated: boolean
}

/** How much the amount can be trusted, which is what the table has to show. */
export type UpcomingCertainty = "known" | "estimated" | "missing"

export const classifyUpcomingLine = (
  line: Pick<UpcomingExpenseLine, "amount" | "amountIsEstimated">
): UpcomingCertainty => {
  if (line.amount === null) {
    return "missing"
  }

  return line.amountIsEstimated ? "estimated" : "known"
}
