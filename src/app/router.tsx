import { createBrowserRouter, redirect } from "react-router"

import { AppShell } from "@/app/layout/app-shell"
import { NotFoundPage } from "@/app/pages/not-found-page"
import { RouteErrorPage } from "@/app/pages/route-error-page"
import { GuestOnlyRoute } from "@/features/auth/components/guest-only-route"
import { LoginPage } from "@/features/auth/components/login-page"
import { RequireAuth } from "@/features/auth/components/require-auth"
import { MonthlyBudgetPage } from "@/features/monthly-budget/monthly-budget-page"
import { ReportsPage } from "@/features/reports/components/reports-page"
import { UpcomingExpensesPage } from "@/features/upcoming-expenses/components/upcoming-expenses-page"
import { getWorkingPeriod } from "@/shared/lib/period"

// Resolved per navigation so a session open across midnight still lands on the
// right month. It lands on the working month (real calendar month + 1), not on
// the real calendar month.
const redirectToCurrentMonth = () => {
  const { year, month } = getWorkingPeriod()

  return redirect(`/months/${year}/${month}`)
}

export const router = createBrowserRouter([
  {
    // Last-resort boundary: covers errors in the shell itself and in the
    // routes outside it, so a crash never leaves a blank page.
    errorElement: <RouteErrorPage />,
    children: [
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
              {
                // A page that crashes keeps the shell (navigation) around it.
                errorElement: <RouteErrorPage fullScreen={false} />,
                children: [
                  // Loading, editing and deleting every kind of expense happens in the
                  // budget itself, so the month has no other page of its own.
                  { index: true, element: <MonthlyBudgetPage /> },
                  { path: "upcoming", element: <UpcomingExpensesPage /> },
                ],
              },
            ],
          },
          {
            // Reports span a range of months (RF-11), so they stay outside the month layout.
            path: "/reports",
            element: <AppShell />,
            children: [
              {
                errorElement: <RouteErrorPage fullScreen={false} />,
                children: [{ index: true, element: <ReportsPage /> }],
              },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])
