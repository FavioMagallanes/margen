import { Outlet, useParams } from "react-router"

import { LogoutButton } from "@/features/auth/components/logout-button"
import { getCurrentPeriod, parsePeriod } from "@/shared/lib/period"

import { MonthSwitcher } from "./month-switcher"
import { BottomNav, Sidebar } from "./sidebar"
import { ThemeToggle } from "./theme-toggle"

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
          <span className="flex items-center gap-2 lg:hidden">
            <img
              src="/margen-web.svg"
              alt=""
              aria-hidden="true"
              className="size-6 rounded-[0.3rem]"
            />
            <span className="text-sm font-semibold tracking-tight">Margen</span>
          </span>

          {routePeriod ? <MonthSwitcher period={routePeriod} /> : <span />}

          <div className="flex items-center gap-1">
            <LogoutButton />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <BottomNav period={navPeriod} />
    </div>
  )
}
