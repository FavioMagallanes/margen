import type { ExpenseLine } from "./expense-total"

/**
 * Where a month line comes from. `other` is not a `spending_plans.kind`:
 * other expenses have no plan, so they are named explicitly here.
 */
export type MonthExpenseKind = "card_purchase" | "loan" | "recurring" | "other"

/**
 * A month line that knows how to be acted on, not only how to be summed.
 * Totals keep working on the plain `ExpenseLine` this extends.
 */
export type MonthExpenseLine = ExpenseLine & {
  kind: MonthExpenseKind
  /**
   * The row to edit or delete for this line: the owning `spending_plans` id
   * for card_purchase/loan/recurring, or the `other_expenses` id itself for
   * "other", since that table has no separate plan.
   */
  planId: string
}
