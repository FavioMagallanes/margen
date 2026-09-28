import { useQuery } from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import {
  type CardPurchaseCurrency,
  CURRENCY_OPTIONS,
} from "../model/card-purchase-form"
import type { CardPurchaseRow } from "../model/card-purchase-groups"

export const CARD_PURCHASE_KIND = "card_purchase"

// Query keys carry the owner and the month so two sessions or two months never
// share a cache entry.
export const cardPurchaseKeys = {
  byUser: (userId: string) => ["card-purchases", userId] as const,
  month: (userId: string, { year, month }: Period) =>
    ["card-purchases", userId, year, month] as const,
}

const toCurrency = (currency: string): CardPurchaseCurrency | null =>
  CURRENCY_OPTIONS.find((option) => option === currency) ?? null

export const fetchCardPurchases = async ({
  year,
  month,
}: Period): Promise<CardPurchaseRow[]> => {
  // RLS scopes the read to the authenticated user, so no user_id filter here.
  // The "!inner" join is what makes the kind filter drop the occurrences of
  // other plan kinds instead of only emptying the embedded plan.
  const { data, error } = await supabase
    .from("expense_occurrences")
    .select(
      "id, plan_id, amount, installment_number, spending_plans!inner(id, concept, group_label, currency, total_installments)"
    )
    .eq("year", year)
    .eq("month", month)
    .eq("spending_plans.kind", CARD_PURCHASE_KIND)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    occurrenceId: row.id,
    planId: row.spending_plans.id,
    card: row.spending_plans.group_label,
    conceptText: row.spending_plans.concept,
    installmentNumber: row.installment_number,
    totalInstallments: row.spending_plans.total_installments,
    amount: row.amount,
    currency: toCurrency(row.spending_plans.currency),
  }))
}

export const useCardPurchasesQuery = (userId: string | null, period: Period) =>
  useQuery({
    queryKey: cardPurchaseKeys.month(userId ?? "", period),
    queryFn: () => fetchCardPurchases(period),
    enabled: userId !== null,
  })
