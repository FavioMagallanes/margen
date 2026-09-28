import {
  useMutation,
  type UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type { OtherExpenseCurrency } from "../model/other-expense-form"
import { otherExpenseKeys } from "./other-expense-queries"

export const CREATE_ERROR_MESSAGE =
  "No pudimos guardar el gasto. Intentá de nuevo en un momento."

export const UPDATE_ERROR_MESSAGE =
  "No pudimos editar el gasto. Intentá de nuevo en un momento."

export const DELETE_ERROR_MESSAGE =
  "No pudimos eliminar el gasto. Intentá de nuevo en un momento."

export type OtherExpenseValues = {
  concept: string
  amount: number
  currency: OtherExpenseCurrency
  /** Descriptive only: it never enables any payment tracking (RF-04). */
  paymentMethod: string | null
}

export type CreateOtherExpenseInput = OtherExpenseValues & {
  period: Period
}

export type UpdateOtherExpenseInput = OtherExpenseValues & {
  id: string
}

/**
 * An expense line belongs to a single month, but the budget summary is cached
 * per month, so the whole "expense-lines" branch is refreshed the same way the
 * card purchase and loan mutations do it.
 */
const invalidateExpenseViews = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
) => {
  void queryClient.invalidateQueries({
    queryKey: otherExpenseKeys.byUser(userId),
  })
  void queryClient.invalidateQueries({
    queryKey: ["monthly-budget", userId, "expense-lines"],
  })
}

const requireUserId = (userId: string | null): string => {
  if (userId === null) {
    throw new Error("Cannot change an expense without an authenticated user")
  }

  return userId
}

export const useCreateOtherExpenseMutation = (
  userId: string | null
): UseMutationResult<void, Error, CreateOtherExpenseInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateOtherExpenseInput) => {
      const ownerId = requireUserId(userId)

      // A single row, with no plan or future installments behind it, so no
      // database function is needed here (unlike loans and card purchases).
      const { error } = await supabase.from("other_expenses").insert({
        user_id: ownerId,
        concept: input.concept,
        amount: input.amount,
        currency: input.currency,
        payment_method: input.paymentMethod,
        year: input.period.year,
        month: input.period.month,
      })

      if (error) {
        // The Supabase detail stays out of the UI.
        throw new Error(CREATE_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateExpenseViews(queryClient, userId)
      }
    },
  })
}

export const useUpdateOtherExpenseMutation = (
  userId: string | null
): UseMutationResult<void, Error, UpdateOtherExpenseInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateOtherExpenseInput) => {
      requireUserId(userId)

      // The month is not editable: an expense always belongs to the month the
      // page is showing, so the edit only rewrites the descriptive columns.
      const { error } = await supabase
        .from("other_expenses")
        .update({
          concept: input.concept,
          amount: input.amount,
          currency: input.currency,
          payment_method: input.paymentMethod,
        })
        .eq("id", input.id)

      if (error) {
        throw new Error(UPDATE_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateExpenseViews(queryClient, userId)
      }
    },
  })
}

export const useDeleteOtherExpenseMutation = (
  userId: string | null
): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expenseId: string) => {
      requireUserId(userId)

      const { error } = await supabase
        .from("other_expenses")
        .delete()
        .eq("id", expenseId)

      if (error) {
        throw new Error(DELETE_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateExpenseViews(queryClient, userId)
      }
    },
  })
}
