import {
  useMutation,
  type UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type { LoanInstallmentAmount } from "../model/loan-installment-amounts"
import { loanKeys } from "./loan-queries"

export const CREATE_ERROR_MESSAGE =
  "No pudimos guardar el préstamo. Intentá de nuevo en un momento."

export const UPDATE_ERROR_MESSAGE =
  "No pudimos editar el préstamo. Intentá de nuevo en un momento."

export const DELETE_ERROR_MESSAGE =
  "No pudimos eliminar el préstamo. Intentá de nuevo en un momento."

export const SAVE_AMOUNTS_ERROR_MESSAGE =
  "No pudimos guardar los importes de las cuotas. Intentá de nuevo en un momento."

export type CreateLoanInput = {
  concept: string
  entity: string
  quotaAmount: number
  startingInstallment: number
  totalInstallments: number
  period: Period
}

export type UpdateLoanInput = {
  planId: string
  concept: string
  entity: string
  /** The installment the user clicked «Editar» on: the edit starts there (P-04). */
  fromInstallment: number
  fromPeriod: Period
  totalInstallments: number
}

/**
 * A loan writes occurrences in several months at once, so every month's
 * expense lines are refreshed, not only the one being viewed.
 */
const invalidateAffectedMonths = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
) => {
  void queryClient.invalidateQueries({ queryKey: loanKeys.byUser(userId) })
  void queryClient.invalidateQueries({
    queryKey: ["monthly-budget", userId, "expense-lines"],
  })
}

const requireUserId = (userId: string | null): string => {
  if (userId === null) {
    throw new Error("Cannot change a loan without an authenticated user")
  }

  return userId
}

export const useCreateLoanMutation = (
  userId: string | null
): UseMutationResult<void, Error, CreateLoanInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateLoanInput) => {
      requireUserId(userId)

      // The RPC creates the plan and every remaining installment atomically.
      const { error } = await supabase.rpc("create_loan", {
        p_concept: input.concept,
        p_entity: input.entity,
        p_starting_installment: input.startingInstallment,
        p_total_installments: input.totalInstallments,
        p_year: input.period.year,
        p_month: input.period.month,
        p_quota_amount: input.quotaAmount,
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

export const useUpdateLoanMutation = (
  userId: string | null
): UseMutationResult<void, Error, UpdateLoanInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateLoanInput) => {
      requireUserId(userId)

      // No amount travels here on purpose: rescheduling a loan never rewrites
      // the amounts already entered for its installments (RF-03).
      const { error } = await supabase.rpc("update_loan", {
        p_plan_id: input.planId,
        p_concept: input.concept,
        p_entity: input.entity,
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

export const useSetLoanInstallmentAmountsMutation = (
  userId: string | null
): UseMutationResult<void, Error, readonly LoanInstallmentAmount[]> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (amounts: readonly LoanInstallmentAmount[]) => {
      requireUserId(userId)

      // One call for the whole batch: either every amount lands or none does.
      const { error } = await supabase.rpc("set_loan_installment_amounts", {
        p_items: amounts.map(({ occurrenceId, amount }) => ({
          occurrence_id: occurrenceId,
          amount,
        })),
      })

      if (error) {
        throw new Error(SAVE_AMOUNTS_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateAffectedMonths(queryClient, userId)
      }
    },
  })
}

export const useDeleteLoanMutation = (
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
