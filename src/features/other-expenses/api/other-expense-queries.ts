import { useQuery } from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type { OtherExpenseCurrency } from "../model/other-expense-form"

export type OtherExpenseRow = {
  id: string
  concept: string
  amount: number
  /** Stored as free text, so an unexpected value must not be read as ARS. */
  currency: OtherExpenseCurrency | null
  paymentMethod: string | null
}

// Query keys carry the owner and the month so two sessions or two months never
// share a cache entry.
export const otherExpenseKeys = {
  byUser: (userId: string) => ["other-expenses", userId] as const,
  month: (userId: string, { year, month }: Period) =>
    ["other-expenses", userId, year, month] as const,
  concepts: (userId: string) => ["other-expenses", userId, "concepts"] as const,
}

const toCurrency = (currency: string): OtherExpenseCurrency | null =>
  currency === "ars" || currency === "usd" ? currency : null

export const fetchOtherExpenses = async ({
  year,
  month,
}: Period): Promise<OtherExpenseRow[]> => {
  // RLS scopes the read to the authenticated user, so no user_id filter here.
  const { data, error } = await supabase
    .from("other_expenses")
    .select("id, concept, amount, currency, payment_method")
    .eq("year", year)
    .eq("month", month)
    .order("created_at")

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    concept: row.concept,
    amount: row.amount,
    currency: toCurrency(row.currency),
    paymentMethod: row.payment_method,
  }))
}

/**
 * RF-04: the concept is free text and the suggestions come from what the user
 * already wrote, across every month, never from a fixed catalogue.
 */
export const fetchOtherExpenseConcepts = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("other_expenses")
    .select("concept")
    .order("concept")

  if (error) {
    throw new Error(error.message)
  }

  const concepts: string[] = []

  for (const row of data ?? []) {
    if (row.concept !== "" && !concepts.includes(row.concept)) {
      concepts.push(row.concept)
    }
  }

  return concepts
}

export const useOtherExpensesQuery = (userId: string | null, period: Period) =>
  useQuery({
    queryKey: otherExpenseKeys.month(userId ?? "", period),
    queryFn: () => fetchOtherExpenses(period),
    enabled: userId !== null,
  })

export const useOtherExpenseConceptsQuery = (userId: string | null) =>
  useQuery({
    queryKey: otherExpenseKeys.concepts(userId ?? ""),
    queryFn: fetchOtherExpenseConcepts,
    enabled: userId !== null,
  })
