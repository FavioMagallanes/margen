import { useState } from "react"
import { Outlet, useLocation, useParams } from "react-router"

import { LogoutButton } from "@/features/auth/components/logout-button"
import {
  getWorkingPeriod,
  isSamePeriod,
  parsePeriod,
  type Period,
} from "@/shared/lib/period"

import { MonthSwitcher } from "./month-switcher"
import { GuideRule, PageGuides } from "./page-guides"
import { BottomNav, DesktopTabs } from "./sidebar"
import { ThemeToggle } from "./theme-toggle"

export const AppShell = () => {
  const { year, month } = useParams()
  const { pathname } = useLocation()
  const routePeriod = parsePeriod(year, month)
  // Routes without a month (Reportes) still need a period for the month
  // links, but it must be wherever the user was last browsing, not always
  // the working month — otherwise leaving Presupuesto in Septiembre and
  // visiting Reportes, then coming back, would silently jump you to Octubre.
  const [rememberedPeriod, setRememberedPeriod] = useState<Period>(
    () => routePeriod ?? getWorkingPeriod()
  )

  if (routePeriod !== null && !isSamePeriod(routePeriod, rememberedPeriod)) {
    setRememberedPeriod(routePeriod)
  }

  const navPeriod = routePeriod ?? rememberedPeriod
  // Próximos meses is a plain read-only projection with fewer columns, so it
  // keeps the regular reading width. Presupuesto and Reportes both hold wide
  // tables that scroll horizontally inside the regular width, so they get
  // the wider content area.
  const isUpcomingRoute = pathname.endsWith("/upcoming")
  const contentWidth = isUpcomingRoute ? "max-w-5xl" : "max-w-7xl"

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      <PageGuides />

      <div>
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur">
          <header className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
            <span className="flex items-center gap-2">
              <img
                src="/margen-web.svg"
                alt=""
                aria-hidden="true"
                className="size-6 rounded-[0.3rem]"
              />
              <span className="text-sm font-semibold tracking-tight">
                Margen
              </span>
            </span>

            {routePeriod ? <MonthSwitcher period={routePeriod} /> : <span />}

            <div className="flex items-center gap-1">
              <LogoutButton />
              <ThemeToggle />
            </div>
          </header>
          <GuideRule />
        </div>

        <DesktopTabs period={navPeriod} />
        <GuideRule className="hidden lg:block" />

        <main
          className={`mx-auto w-full ${contentWidth} px-4 pt-6 pb-24 lg:px-8 lg:pb-10`}
        >
          <Outlet />
        </main>
        <GuideRule />
      </div>

      <BottomNav period={navPeriod} />
    </div>
  )
}
