import { useQuery } from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type { PendingLoanInstallment } from "../model/loan-installment-amounts"
import type { LoanRow } from "../model/loan-rows"

export const LOAN_KIND = "loan"

// Query keys carry the owner and the month so two sessions or two months never
// share a cache entry.
export const loanKeys = {
  byUser: (userId: string) => ["loans", userId] as const,
  month: (userId: string, { year, month }: Period) =>
    ["loans", userId, year, month] as const,
  pendingInstallments: (userId: string) =>
    ["loans", userId, "pending-installments"] as const,
}

export type PendingLoanInstallmentRow = PendingLoanInstallment & {
  planId: string
}

export const fetchLoans = async ({
  year,
  month,
}: Period): Promise<LoanRow[]> => {
  // RLS scopes the read to the authenticated user, so no user_id filter here.
  // The "!inner" join is what makes the kind filter drop the occurrences of
  // other plan kinds instead of only emptying the embedded plan.
  const { data, error } = await supabase
    .from("expense_occurrences")
    .select(
      "id, plan_id, amount, installment_number, spending_plans!inner(id, concept, group_label, total_installments)"
    )
    .eq("year", year)
    .eq("month", month)
    .eq("spending_plans.kind", LOAN_KIND)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    occurrenceId: row.id,
    planId: row.spending_plans.id,
    entity: row.spending_plans.group_label,
    conceptText: row.spending_plans.concept,
    installmentNumber: row.installment_number,
    totalInstallments: row.spending_plans.total_installments,
    amount: row.amount,
  }))
}

/**
 * Every installment still missing its amount, in calendar order and without a
 * month filter: the page needs the past and current ones to warn about an
 * incomplete subtotal, and the batch form needs the upcoming ones.
 */
export const fetchPendingLoanInstallments = async (): Promise<
  PendingLoanInstallmentRow[]
> => {
  const { data, error } = await supabase
    .from("expense_occurrences")
    .select(
      "id, plan_id, year, month, installment_number, spending_plans!inner(id)"
    )
    .eq("spending_plans.kind", LOAN_KIND)
    .is("amount", null)
    .order("year")
    .order("month")

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    occurrenceId: row.id,
    planId: row.plan_id,
    year: row.year,
    month: row.month,
    installmentNumber: row.installment_number,
  }))
}

export const useLoansQuery = (userId: string | null, period: Period) =>
  useQuery({
    queryKey: loanKeys.month(userId ?? "", period),
    queryFn: () => fetchLoans(period),
    enabled: userId !== null,
  })

export const usePendingLoanInstallmentsQuery = (userId: string | null) =>
  useQuery({
    queryKey: loanKeys.pendingInstallments(userId ?? ""),
    queryFn: fetchPendingLoanInstallments,
    enabled: userId !== null,
  })
