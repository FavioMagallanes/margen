import { createBrowserRouter, redirect } from "react-router"

import { AppShell } from "@/app/layout/app-shell"
import { PlaceholderPage } from "@/app/pages/placeholder-page"
import { GuestOnlyRoute } from "@/features/auth/components/guest-only-route"
import { LoginPage } from "@/features/auth/components/login-page"
import { RequireAuth } from "@/features/auth/components/require-auth"
import { CardPurchasesPage } from "@/features/card-purchases/components/card-purchases-page"
import { LoansPage } from "@/features/loans/components/loans-page"
import { MonthlyBudgetPage } from "@/features/monthly-budget/monthly-budget-page"
import { OtherExpensesPage } from "@/features/other-expenses/components/other-expenses-page"
import { RecurringExpensesPage } from "@/features/recurring-expenses/components/recurring-expenses-page"
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
          { index: true, element: <MonthlyBudgetPage /> },
          { path: "cards", element: <CardPurchasesPage /> },
          { path: "loans", element: <LoansPage /> },
          {
            path: "recurring",
            element: <RecurringExpensesPage />,
          },
          { path: "other", element: <OtherExpensesPage /> },
        ],
      },
      {
        // Reports span a range of months (RF-11), so they stay outside the month layout.
        path: "/reports",
        element: <AppShell />,
        children: [
          { index: true, element: <PlaceholderPage title="Reportes" /> },
        ],
      },
    ],
  },
])
