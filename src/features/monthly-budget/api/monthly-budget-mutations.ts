import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { Period } from "@/shared/lib/period"
import { supabase } from "@/shared/lib/supabase/client"

import { monthlyBudgetKeys } from "./monthly-budget-queries"

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
