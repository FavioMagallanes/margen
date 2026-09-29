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
  getWorkingPeriod,
  isPeriodBefore,
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
  // "Hoy" targets the working month (real calendar month + 1), same as the
  // router redirect, since that is the month the user is loading expenses for.
  const workingPeriod = getWorkingPeriod()
  // A month before the real current one has already happened: the arrow
  // stops there so browsing does not casually wander into settled history,
  // while a saved link to an old month still opens it if the user wants to.
  const previousPeriod = addMonths(period, -1)
  const canGoToPreviousMonth = !isPeriodBefore(
    previousPeriod,
    getCurrentPeriod()
  )

  const goToPeriod = (nextPeriod: Period) => {
    void navigate(buildMonthPath(pathname, nextPeriod))
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Mes anterior"
        disabled={!canGoToPreviousMonth}
        onClick={() => goToPeriod(previousPeriod)}
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

      {isSamePeriod(period, workingPeriod) ? null : (
        <Button
          variant="outline"
          size="sm"
          className="ml-2"
          onClick={() => goToPeriod(workingPeriod)}
        >
          Hoy
        </Button>
      )}
    </div>
  )
}
