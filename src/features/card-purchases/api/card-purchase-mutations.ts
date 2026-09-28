import {
  useMutation,
  type UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type { CardPurchaseBatchItem } from "../model/card-purchase-batch"
import type {
  CardOption,
  CardPurchaseCurrency,
} from "../model/card-purchase-form"
import { cardPurchaseKeys } from "./card-purchase-queries"

export const CREATE_ERROR_MESSAGE =
  "No pudimos guardar la compra. Intentá de nuevo en un momento."

export const CREATE_BATCH_ERROR_MESSAGE =
  "No pudimos guardar el lote de compras. No se guardó ninguna: revisá los datos e intentá de nuevo."

export const UPDATE_ERROR_MESSAGE =
  "No pudimos editar la compra. Intentá de nuevo en un momento."

export const DELETE_ERROR_MESSAGE =
  "No pudimos eliminar la compra. Intentá de nuevo en un momento."

export type CreateCardPurchaseInput = {
  concept: string
  card: CardOption
  currency: CardPurchaseCurrency
  quotaAmount: number
  startingInstallment: number
  totalInstallments: number
  period: Period
}

export type CreateCardPurchasesBatchInput = {
  card: CardOption
  period: Period
  items: readonly CardPurchaseBatchItem[]
}

export type UpdateCardPurchaseInput = {
  planId: string
  concept: string
  card: CardOption
  currency: CardPurchaseCurrency
  quotaAmount: number
  /** The installment the user clicked «Editar» on: the edit starts there (P-04). */
  fromInstallment: number
  fromPeriod: Period
  totalInstallments: number
}

/**
 * A card purchase writes occurrences in several months at once, so every
 * month's expense lines are refreshed, not only the one being viewed.
 */
const invalidateAffectedMonths = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
) => {
  void queryClient.invalidateQueries({
    queryKey: cardPurchaseKeys.byUser(userId),
  })
  void queryClient.invalidateQueries({
    queryKey: ["monthly-budget", userId, "expense-lines"],
  })
}

const requireUserId = (userId: string | null): string => {
  if (userId === null) {
    throw new Error(
      "Cannot change a card purchase without an authenticated user"
    )
  }

  return userId
}

export const useCreateCardPurchaseMutation = (
  userId: string | null
): UseMutationResult<void, Error, CreateCardPurchaseInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCardPurchaseInput) => {
      requireUserId(userId)

      // The RPC creates the plan and every remaining installment atomically.
      const { error } = await supabase.rpc("create_card_purchase", {
        p_concept: input.concept,
        p_card: input.card,
        p_currency: input.currency,
        p_quota_amount: input.quotaAmount,
        p_starting_installment: input.startingInstallment,
        p_total_installments: input.totalInstallments,
        p_year: input.period.year,
        p_month: input.period.month,
      })

      if (error) {
        // The Supabase detail stays out of the UI.
        throw new Error(CREATE_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateAffectedMonths(queryClient, userId)
      }
    },
  })
}

export const useCreateCardPurchasesBatchMutation = (
  userId: string | null
): UseMutationResult<void, Error, CreateCardPurchasesBatchInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCardPurchasesBatchInput) => {
      requireUserId(userId)

      // RF-09: one call for the whole batch, so either every purchase of the
      // list lands or none does.
      const { error } = await supabase.rpc("create_card_purchases_batch", {
        p_card: input.card,
        p_year: input.period.year,
        p_month: input.period.month,
        p_items: input.items.map((item) => ({
          concept: item.concept,
          currency: item.currency,
          quota_amount: item.quotaAmount,
          starting_installment: item.startingInstallment,
          total_installments: item.totalInstallments,
        })),
      })

      if (error) {
        throw new Error(CREATE_BATCH_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateAffectedMonths(queryClient, userId)
      }
    },
  })
}

export const useUpdateCardPurchaseMutation = (
  userId: string | null
): UseMutationResult<void, Error, UpdateCardPurchaseInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateCardPurchaseInput) => {
      requireUserId(userId)

      const { error } = await supabase.rpc("update_card_purchase", {
        p_plan_id: input.planId,
        p_concept: input.concept,
        p_card: input.card,
        p_currency: input.currency,
        p_quota_amount: input.quotaAmount,
        p_from_installment: input.fromInstallment,
        p_from_year: input.fromPeriod.year,
        p_from_month: input.fromPeriod.month,
        p_total_installments: input.totalInstallments,
      })

      if (error) {
        throw new Error(UPDATE_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateAffectedMonths(queryClient, userId)
      }
    },
  })
}

export const useDeleteCardPurchaseMutation = (
  userId: string | null
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (planId: string) => {
      requireUserId(userId)

      // The schema's "on delete cascade" removes the plan's occurrences.
      const { error } = await supabase
        .from("spending_plans")
        .delete()
        .eq("id", planId)

      if (error) {
        throw new Error(DELETE_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateAffectedMonths(queryClient, userId)
      }
    },
  })
}
