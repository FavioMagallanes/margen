import { Outlet, useLocation, useParams } from "react-router"

import { LogoutButton } from "@/features/auth/components/logout-button"
import { getWorkingPeriod, parsePeriod } from "@/shared/lib/period"

import { MonthSwitcher } from "./month-switcher"
import { BottomNav, DesktopTabs } from "./sidebar"
import { ThemeToggle } from "./theme-toggle"

export const AppShell = () => {
  const { year, month } = useParams()
  const { pathname } = useLocation()
  const routePeriod = parsePeriod(year, month)
  // Routes without a month (Reportes) still need a period for the month
  // links. Presupuesto/Próximos meses default to the working month (real
  // calendar month + 1), so the nav links land there too, not on the real
  // calendar month.
  const navPeriod = routePeriod ?? getWorkingPeriod()
  // Próximos meses is a plain read-only projection with fewer columns, so it
  // keeps the regular reading width. Presupuesto and Reportes both hold wide
  // tables that scroll horizontally inside the regular width, so they get
  // the wider content area.
  const isUpcomingRoute = pathname.endsWith("/upcoming")
  const contentWidth = isUpcomingRoute ? "max-w-5xl" : "max-w-7xl"

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-8">
          <span className="flex items-center gap-2">
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

        <DesktopTabs period={navPeriod} />

        <main
          className={`mx-auto w-full ${contentWidth} px-4 pt-6 pb-24 lg:px-8 lg:pb-10`}
        >
          <Outlet />
        </main>
      </div>

      <BottomNav period={navPeriod} />
    </div>
  )
}
