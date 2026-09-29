import { useMutation, useQueryClient } from "@tanstack/react-query"

import { cardPurchaseKeys } from "@/features/card-purchases/api/card-purchase-queries"
import { loanKeys } from "@/features/loans/api/loan-queries"
import { otherExpenseKeys } from "@/features/other-expenses/api/other-expense-queries"
import { recurringKeys } from "@/features/recurring-expenses/api/recurring-expense-queries"
import { fetchTarjetaExchangeRate } from "@/shared/lib/exchange-rate-api"
import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import {
  type ExchangeRateSource,
  monthlyBudgetKeys,
} from "./monthly-budget-queries"

export const FETCH_EXCHANGE_RATE_ERROR_MESSAGE =
  "No pudimos consultar la cotización. Intentá de nuevo en un momento."

export const SAVE_EXCHANGE_RATE_ERROR_MESSAGE =
  "No pudimos guardar la cotización. Intentá de nuevo en un momento."

export const CLEAR_MONTH_ERROR_MESSAGE =
  "No pudimos limpiar el mes. Intentá de nuevo en un momento."

type ClearMonthRpc = (
  fn: "clear_month",
  args: { p_year: number; p_month: number }
) => PromiseLike<{ error: { message: string } | null }>

export type SaveSalaryInput = {
  period: Period
  salaryArs: number
}

export const useSaveSalaryMutation = (userId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ period, salaryArs }: SaveSalaryInput) => {
      if (userId === null) {
        throw new Error("Cannot save a salary without an authenticated user")
      }

      if (salaryArs < 0) {
        throw new Error("Salary must be zero or a positive amount")
      }

      // The unique (user_id, year, month) constraint makes a repeated submit
      // update the same row instead of creating a second budget for the month.
      const { error } = await supabase.from("monthly_budgets").upsert(
        {
          user_id: userId,
          year: period.year,
          month: period.month,
          salary_ars: salaryArs,
        },
        { onConflict: "user_id,year,month" }
      )

      if (error) {
        throw new Error(error.message)
      }
    },
    onSuccess: (_result, { period }) => {
      if (userId === null) {
        return
      }

      void queryClient.invalidateQueries({
        queryKey: monthlyBudgetKeys.budget(userId, period),
      })
    },
  })
}

export type SaveExchangeRateInput = {
  period: Period
  rateArs: number
  source: ExchangeRateSource
  /** Only the provider reports one; a manual rate always saves null. */
  sourceUpdatedAt: string | null
}

/**
 * RF-07: querying the provider is an explicit action, never part of rendering,
 * so it runs as a mutation the user triggers and can retry.
 */
export const useFetchTarjetaExchangeRateMutation = () =>
  useMutation({
    mutationFn: async () => {
      try {
        return await fetchTarjetaExchangeRate()
      } catch {
        // The provider detail stays out of the UI.
        throw new Error(FETCH_EXCHANGE_RATE_ERROR_MESSAGE)
      }
    },
  })

export const useSaveExchangeRateMutation = (userId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      period,
      rateArs,
      source,
      sourceUpdatedAt,
    }: SaveExchangeRateInput) => {
      if (userId === null) {
        throw new Error(
          "Cannot save an exchange rate without an authenticated user"
        )
      }

      if (!Number.isFinite(rateArs) || rateArs <= 0) {
        throw new Error("Exchange rate must be a positive amount")
      }

      // The payload only carries the exchange rate columns: the upsert becomes
      // an "on conflict do update set" over exactly these columns, so saving a
      // rate never clears the salary already stored for the month.
      const { error } = await supabase.from("monthly_budgets").upsert(
        {
          user_id: userId,
          year: period.year,
          month: period.month,
          exchange_rate_value: rateArs,
          exchange_rate_source: source,
          exchange_rate_fetched_at: new Date().toISOString(),
          exchange_rate_source_updated_at: sourceUpdatedAt,
        },
        { onConflict: "user_id,year,month" }
      )

      if (error) {
        throw new Error(SAVE_EXCHANGE_RATE_ERROR_MESSAGE)
      }
    },
    onSuccess: (_result, { period }) => {
      if (userId === null) {
        return
      }

      void queryClient.invalidateQueries({
        queryKey: monthlyBudgetKeys.budget(userId, period),
      })
    },
  })
}

export const useClearMonthMutation = (userId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (period: Period) => {
      if (userId === null) {
        throw new Error("Cannot clear a month without an authenticated user")
      }

      // clear_month is not in the generated types until they are regenerated
      // after the migration is applied, so the call is typed by hand.
      const callClearMonth = supabase.rpc.bind(supabase) as ClearMonthRpc
      const { error } = await callClearMonth("clear_month", {
        p_year: period.year,
        p_month: period.month,
      })

      if (error) {
        throw new Error(CLEAR_MONTH_ERROR_MESSAGE)
      }
    },
    onSuccess: () => {
      if (userId === null) {
        return
      }

      // Clearing a month deletes whole plans, so months other than the cleared
      // one change too (past and future installments). Everything derived from
      // expenses is invalidated for this user, whatever the month.
      for (const queryKey of [
        // These features expose no per-user key, so use their user prefix.
        ["monthly-budget", userId],
        ["reports", userId],
        ["upcoming-expenses", userId],
        cardPurchaseKeys.byUser(userId),
        loanKeys.byUser(userId),
        recurringKeys.byUser(userId),
        otherExpenseKeys.byUser(userId),
      ]) {
        void queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
