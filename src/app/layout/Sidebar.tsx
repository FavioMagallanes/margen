import { NavLink } from "react-router"

import {
  BankFreeIcons,
  CreditCardFreeIcons,
  Invoice01FreeIcons,
  RepeatFreeIcons,
  Wallet01FreeIcons,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"

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
    label: "Tarjetas",
    icon: CreditCardFreeIcons,
    buildPath: ({ year, month }) => `/months/${year}/${month}/cards`,
    end: false,
  },
  {
    label: "Préstamos",
    icon: BankFreeIcons,
    buildPath: ({ year, month }) => `/months/${year}/${month}/loans`,
    end: false,
  },
  {
    label: "Recurrentes",
    icon: RepeatFreeIcons,
    buildPath: ({ year, month }) => `/months/${year}/${month}/recurring`,
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

export const Sidebar = ({ period }: NavProps) => (
  <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
    <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
      <span className="size-2 rounded-full bg-sidebar-primary" />
      <span className="text-sm font-semibold tracking-tight">Margen</span>
    </div>

    <nav
      aria-label="Navegación principal"
      className="flex flex-col gap-0.5 p-2"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.label}
          to={item.buildPath(period)}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive &&
                "border-l-sidebar-primary bg-sidebar-accent font-medium text-sidebar-primary"
            )
          }
        >
          <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.5} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  </aside>
)

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
