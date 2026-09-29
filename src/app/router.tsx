import { createBrowserRouter, redirect } from "react-router"

import { AppShell } from "@/app/layout/app-shell"
import { GuestOnlyRoute } from "@/features/auth/components/guest-only-route"
import { LoginPage } from "@/features/auth/components/login-page"
import { RequireAuth } from "@/features/auth/components/require-auth"
import { MonthlyBudgetPage } from "@/features/monthly-budget/monthly-budget-page"
import { ReportsPage } from "@/features/reports/components/reports-page"
import { UpcomingExpensesPage } from "@/features/upcoming-expenses/components/upcoming-expenses-page"
import { getCurrentPeriod } from "@/shared/lib/period"

// Resolved per navigation so a session open across midnight still lands on today.
const redirectToCurrentMonth = () => {
  const { year, month } = getCurrentPeriod()

  return redirect(`/months/${year}/${month}`)
}

export const router = createBrowserRouter([
  { path: "/", loader: redirectToCurrentMonth },
  {
    path: "/login",
    element: (
      <GuestOnlyRoute>
        <LoginPage />
      </GuestOnlyRoute>
    ),
  },
  {
    // Everything below this layout route requires a Supabase session (RF-13).
    element: <RequireAuth />,
    children: [
      {
        path: "/months/:year/:month",
        element: <AppShell />,
        children: [
          // Loading, editing and deleting every kind of expense happens in the
          // budget itself, so the month has no other page of its own.
          { index: true, element: <MonthlyBudgetPage /> },
          { path: "upcoming", element: <UpcomingExpensesPage /> },
        ],
      },
      {
        // Reports span a range of months (RF-11), so they stay outside the month layout.
        path: "/reports",
        element: <AppShell />,
        children: [{ index: true, element: <ReportsPage /> }],
      },
    ],
  },
])
