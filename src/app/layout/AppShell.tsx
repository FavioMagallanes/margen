import { Outlet, useParams } from "react-router"

import { getCurrentPeriod, parsePeriod } from "@/shared/lib/period"

import { MonthSwitcher } from "./MonthSwitcher"
import { BottomNav, Sidebar } from "./Sidebar"
import { ThemeToggle } from "./ThemeToggle"

export const AppShell = () => {
  const { year, month } = useParams()
  const routePeriod = parsePeriod(year, month)
  // Routes without a month (Reportes) still need a period for the month links.
  const navPeriod = routePeriod ?? getCurrentPeriod()

  return (
    <div className="min-h-svh bg-background text-foreground">
      <Sidebar period={navPeriod} />

      <div className="lg:pl-56">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-8">
          <span className="text-sm font-semibold tracking-tight lg:hidden">
            Margen
          </span>

          {routePeriod ? <MonthSwitcher period={routePeriod} /> : <span />}

          <ThemeToggle />
        </header>

        <main className="px-4 pt-6 pb-24 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <BottomNav period={navPeriod} />
    </div>
  )
}
