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
  // "Hoy" targets the real calendar month, not the working month used as the
  // default landing (see router redirect).
  const currentPeriod = getCurrentPeriod()
  // A month before the real current one has already happened: the arrow
  // stops there so browsing does not casually wander into settled history,
  // while a saved link to an old month still opens it if the user wants to.
  const previousPeriod = addMonths(period, -1)
  const canGoToPreviousMonth = !isPeriodBefore(previousPeriod, currentPeriod)

  const goToPeriod = (nextPeriod: Period) => {
    void navigate(buildMonthPath(pathname, nextPeriod))
  }

  return (
    <div className="flex items-center gap-1">
      {canGoToPreviousMonth ? (
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Mes anterior"
          onClick={() => goToPeriod(previousPeriod)}
        >
          <HugeiconsIcon icon={ArrowLeft01FreeIcons} size={20} />
        </Button>
      ) : (
        // Same footprint as the hidden arrow so the label does not shift.
        <span aria-hidden className="size-8" />
      )}

      <span className="min-w-40 text-center text-sm font-medium">
        {formatPeriodLabel(period)}
      </span>

      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Mes siguiente"
        onClick={() => goToPeriod(addMonths(period, 1))}
      >
        <HugeiconsIcon icon={ArrowRight01FreeIcons} size={20} />
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
