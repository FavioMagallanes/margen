import { NavLink, useLocation } from "react-router"

import {
  Calendar03FreeIcons,
  Invoice01FreeIcons,
  Wallet01FreeIcons,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"

import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import type { Period } from "@/shared/lib/period"

type NavItem = {
  label: string
  icon: IconSvgElement
  buildPath: (period: Period) => string
  /** Index routes must not stay active while a child route is rendered. */
  end: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Presupuesto",
    icon: Wallet01FreeIcons,
    buildPath: ({ year, month }) => `/months/${year}/${month}`,
    end: true,
  },
  {
    label: "Próximos meses",
    icon: Calendar03FreeIcons,
    buildPath: ({ year, month }) => `/months/${year}/${month}/upcoming`,
    end: false,
  },
  {
    label: "Reportes",
    icon: Invoice01FreeIcons,
    buildPath: () => "/reports",
    end: false,
  },
]

type NavProps = {
  period: Period
}

const isPathActive = (pathname: string, path: string, end: boolean) =>
  pathname === path || (!end && pathname.startsWith(`${path}/`))

export const DesktopTabs = ({ period }: NavProps) => {
  const { pathname } = useLocation()
  // Mirrors NavLink's own matching so the highlighted tab follows the route.
  const activeItem = NAV_ITEMS.find((item) =>
    isPathActive(pathname, item.buildPath(period), item.end)
  )

  return (
    <Tabs
      value={activeItem?.label ?? null}
      render={<nav aria-label="Navegación principal" />}
      className="hidden gap-0 lg:block"
    >
      <TabsList className="mx-auto flex h-11 w-full max-w-7xl gap-1 bg-transparent px-8 py-0">
        {NAV_ITEMS.map((item) => (
          <TabsTab
            key={item.label}
            value={item.label}
            nativeButton={false}
            render={<NavLink to={item.buildPath(period)} end={item.end} />}
            className="h-11 flex-none rounded-none px-4 text-sm data-selected:bg-transparent data-selected:text-primary data-selected:shadow-none"
          >
            <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.5} />
            {item.label}
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  )
}

export const BottomNav = ({ period }: NavProps) => (
  <nav
    aria-label="Navegación principal (móvil)"
    className="fixed inset-x-0 bottom-0 z-10 flex border-t border-sidebar-border bg-sidebar lg:hidden"
  >
    {NAV_ITEMS.map((item) => (
      <NavLink
        key={item.label}
        to={item.buildPath(period)}
        end={item.end}
        className={({ isActive }) =>
          cn(
            "flex flex-1 flex-col items-center gap-1 border-t-2 border-transparent py-2 text-[0.625rem] text-muted-foreground transition-colors",
            isActive && "border-t-sidebar-primary text-sidebar-primary"
          )
        }
      >
        <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.5} />
        {item.label}
      </NavLink>
    ))}
  </nav>
)
