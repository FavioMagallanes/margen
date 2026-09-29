import { Outlet, useLocation, useParams } from "react-router"

import { LogoutButton } from "@/features/auth/components/logout-button"
import { getCurrentPeriod, parsePeriod } from "@/shared/lib/period"

import { MonthSwitcher } from "./month-switcher"
import { BottomNav, DesktopTabs } from "./sidebar"
import { ThemeToggle } from "./theme-toggle"

const REPORTS_PATH = "/reports"

export const AppShell = () => {
  const { year, month } = useParams()
  const { pathname } = useLocation()
  const routePeriod = parsePeriod(year, month)
  // Routes without a month (Reportes) still need a period for the month links.
  const navPeriod = routePeriod ?? getCurrentPeriod()
  // The reports table has many columns and gets cut off inside the regular
  // reading width, so only that route gets a wider content area.
  const contentWidth = pathname === REPORTS_PATH ? "max-w-7xl" : "max-w-5xl"

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
