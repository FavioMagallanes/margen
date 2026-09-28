import { useNavigate } from "react-router"
import { useLocation } from "react-router"

import {
  ArrowLeft01FreeIcons,
  ArrowRight01FreeIcons,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import type { Period } from "@/shared/lib/period"
import {
  addMonths,
  formatPeriodLabel,
  getCurrentPeriod,
  isSamePeriod,
} from "@/shared/lib/period"

const MONTH_SEGMENTS_PATTERN = /^\/months\/\d+\/\d+/

// Keeps the current section (cards, loans, ...) while only the month changes.
const buildMonthPath = (pathname: string, period: Period) => {
  const section = pathname.replace(MONTH_SEGMENTS_PATTERN, "")

  return `/months/${period.year}/${period.month}${section}`
}

type MonthSwitcherProps = {
  period: Period
}

export const MonthSwitcher = ({ period }: MonthSwitcherProps) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const currentPeriod = getCurrentPeriod()

  const goToPeriod = (nextPeriod: Period) => {
    void navigate(buildMonthPath(pathname, nextPeriod))
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Mes anterior"
        onClick={() => goToPeriod(addMonths(period, -1))}
      >
        <HugeiconsIcon icon={ArrowLeft01FreeIcons} size={16} />
      </Button>

      <span className="min-w-40 text-center text-sm font-medium">
        {formatPeriodLabel(period)}
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Mes siguiente"
        onClick={() => goToPeriod(addMonths(period, 1))}
      >
        <HugeiconsIcon icon={ArrowRight01FreeIcons} size={16} />
      </Button>

      {isSamePeriod(period, currentPeriod) ? null : (
        <Button
          variant="outline"
          size="sm"
          className="ml-2"
          onClick={() => goToPeriod(currentPeriod)}
        >
          Hoy
        </Button>
      )}
    </div>
  )
}
