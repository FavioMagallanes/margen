import { CardPurchaseLineActions } from "@/features/card-purchases/components/card-purchase-line-actions"
import { LoanLineActions } from "@/features/loans/components/loan-line-actions"
import { OtherExpenseLineActions } from "@/features/other-expenses/components/other-expense-line-actions"
import { RecurringLineActions } from "@/features/recurring-expenses/components/recurring-line-actions"
import type { Period } from "@/shared/lib/period"

import type { MonthExpenseLine } from "../model/month-expense-line"

type MonthExpenseActionsProps = {
  line: MonthExpenseLine
  period: Period
}

/**
 * Every line of the month is edited and deleted by the feature that owns it:
 * the budget only routes the row to that feature's actions, and never learns
 * how a purchase, a loan, a recurring expense or a one-off expense is saved.
 */
export const MonthExpenseActions = ({
  line,
  period,
}: MonthExpenseActionsProps) => {
  // An occurrence whose plan could not be read has no editable target, so it
  // offers no action instead of pointing at the wrong row.
  if (line.planId === "") {
    return <span className="text-muted-foreground">—</span>
  }

  if (line.kind === "card_purchase") {
    return (
      <CardPurchaseLineActions
        period={period}
        planId={line.planId}
        concept={line.concept}
      />
    )
  }

  if (line.kind === "loan") {
    return (
      <LoanLineActions
        period={period}
        planId={line.planId}
        concept={line.concept}
      />
    )
  }

  if (line.kind === "recurring") {
    return (
      <RecurringLineActions
        period={period}
        planId={line.planId}
        occurrenceId={line.id}
        concept={line.concept}
      />
    )
  }

  return (
    <OtherExpenseLineActions
      period={period}
      expenseId={line.planId}
      concept={line.concept}
    />
  )
}
