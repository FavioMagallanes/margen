import {
  useMutation,
  type UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import type {
  CreateRecurringPlanInput,
  RecurringPlanInput,
} from "../model/recurring-expense-form"
import type { RecurringOccurrenceItem } from "../model/recurring-generation"
import { recurringKeys } from "./recurring-expense-queries"

export const CREATE_ERROR_MESSAGE =
  "No pudimos guardar el recurrente. Intentá de nuevo en un momento."

export const UPDATE_ERROR_MESSAGE =
  "No pudimos editar el recurrente. Intentá de nuevo en un momento."

export const GENERATE_ERROR_MESSAGE =
  "No pudimos generar los recurrentes del mes. Intentá de nuevo en un momento."

export const SET_AMOUNT_ERROR_MESSAGE =
  "No pudimos guardar el importe de este mes. Intentá de nuevo en un momento."

export const STOP_ERROR_MESSAGE =
  "No pudimos detener el recurrente. Intentá de nuevo en un momento."

export const DELETE_ERROR_MESSAGE =
  "No pudimos eliminar el recurrente. Intentá de nuevo en un momento."

export type CreateRecurringInput = CreateRecurringPlanInput & {
  period: Period
}

export type UpdateRecurringInput = RecurringPlanInput & {
  planId: string
  /** The edit applies from the month the user is standing on (P-04). */
  fromPeriod: Period
}

export type GenerateRecurringInput = {
  period: Period
  items: readonly RecurringOccurrenceItem[]
}

export type SetRecurringAmountInput = {
  occurrenceId: string
  amount: number
  isEstimated: boolean
}

export type StopRecurringInput = {
  planId: string
  fromPeriod: Period
}

/**
 * The SQL arguments default to null, so omitting one is how a plan stays of
 * variable amount ("no hay importe que repetir") or without a known end.
 */
const toPlanArgs = ({
  concept,
  groupLabel,
  currency,
  defaultAmount,
  totalInstallments,
}: RecurringPlanInput) => ({
  p_concept: concept,
  p_group_label: groupLabel,
  p_currency: currency,
  ...(defaultAmount === null ? {} : { p_default_amount: defaultAmount }),
  ...(totalInstallments === null
    ? {}
    : { p_total_installments: totalInstallments }),
})

/**
 * A recurring expense can write months other than the viewed one (an edit
 * reaches every month from this one onwards), so every month's expense lines
 * are refreshed, not only the one being viewed.
 */
const invalidateAffectedMonths = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
) => {
  void queryClient.invalidateQueries({ queryKey: recurringKeys.byUser(userId) })
  void queryClient.invalidateQueries({
    queryKey: ["monthly-budget", userId, "expense-lines"],
  })
}

const requireUserId = (userId: string | null): string => {
  if (userId === null) {
    throw new Error(
      "Cannot change a recurring expense without an authenticated user"
    )
  }

  return userId
}

export const useCreateRecurringMutation = (
  userId: string | null
): UseMutationResult<void, Error, CreateRecurringInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateRecurringInput) => {
      requireUserId(userId)

      // The RPC creates the plan and only the month being viewed: the
      // following ones need an explicit generation, month by month.
      const { error } = await supabase.rpc("create_recurring_plan", {
        ...toPlanArgs(input),
        p_year: input.period.year,
        p_month: input.period.month,
        p_starting_amount: input.startingAmount,
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

export const useUpdateRecurringMutation = (
  userId: string | null
): UseMutationResult<void, Error, UpdateRecurringInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateRecurringInput) => {
      requireUserId(userId)

      const { error } = await supabase.rpc("update_recurring_plan", {
        ...toPlanArgs(input),
        p_plan_id: input.planId,
        p_from_year: input.fromPeriod.year,
        p_from_month: input.fromPeriod.month,
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

export const useGenerateRecurringOccurrencesMutation = (
  userId: string | null
): UseMutationResult<void, Error, GenerateRecurringInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: GenerateRecurringInput) => {
      requireUserId(userId)

      // One call for the whole month: either every decision lands or none does.
      const { error } = await supabase.rpc("set_recurring_occurrences", {
        p_year: input.period.year,
        p_month: input.period.month,
        p_items: input.items.map((item) =>
          item.action === "skip"
            ? { plan_id: item.planId, action: "skip" }
            : {
                plan_id: item.planId,
                action: "fill",
                amount: item.amount,
                is_estimated: item.isEstimated,
              }
        ),
      })

      if (error) {
        throw new Error(GENERATE_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateAffectedMonths(queryClient, userId)
      }
    },
  })
}

export const useSetRecurringAmountMutation = (
  userId: string | null
): UseMutationResult<void, Error, SetRecurringAmountInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SetRecurringAmountInput) => {
      requireUserId(userId)

      // Only this month is corrected: the plan keeps its own fixed amount.
      const { error } = await supabase.rpc("set_recurring_occurrence_amount", {
        p_occurrence_id: input.occurrenceId,
        p_amount: input.amount,
        p_is_estimated: input.isEstimated,
      })

      if (error) {
        throw new Error(SET_AMOUNT_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateAffectedMonths(queryClient, userId)
      }
    },
  })
}

export const useStopRecurringMutation = (
  userId: string | null
): UseMutationResult<void, Error, StopRecurringInput> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: StopRecurringInput) => {
      requireUserId(userId)

      // Stopping keeps the months already generated before this one.
      const { error } = await supabase.rpc("stop_recurring_plan", {
        p_plan_id: input.planId,
        p_from_year: input.fromPeriod.year,
        p_from_month: input.fromPeriod.month,
      })

      if (error) {
        throw new Error(STOP_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId !== null) {
        invalidateAffectedMonths(queryClient, userId)
      }
    },
  })
}

export const useDeleteRecurringMutation = (
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
