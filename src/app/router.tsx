import { createBrowserRouter, redirect } from "react-router"

import { AppShell } from "@/app/layout/AppShell"
import { PlaceholderPage } from "@/app/pages/PlaceholderPage"
import { MonthlyBudgetPage } from "@/features/monthly-budget/MonthlyBudgetPage"
import { getCurrentPeriod } from "@/shared/lib/period"

// Resolved per navigation so a session open across midnight still lands on today.
const redirectToCurrentMonth = () => {
  const { year, month } = getCurrentPeriod()

  return redirect(`/months/${year}/${month}`)
}

export const router = createBrowserRouter([
  { path: "/", loader: redirectToCurrentMonth },
  {
    path: "/months/:year/:month",
    element: <AppShell />,
    children: [
      { index: true, element: <MonthlyBudgetPage /> },
      { path: "cards", element: <PlaceholderPage title="Tarjetas" /> },
      { path: "loans", element: <PlaceholderPage title="Préstamos" /> },
      { path: "recurring", element: <PlaceholderPage title="Recurrentes" /> },
    ],
  },
  {
    // Reports span a range of months (RF-11), so they stay outside the month layout.
    path: "/reports",
    element: <AppShell />,
    children: [{ index: true, element: <PlaceholderPage title="Reportes" /> }],
  },
])
