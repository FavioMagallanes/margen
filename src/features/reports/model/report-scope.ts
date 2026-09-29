import { formatPeriodLabel, type Period } from "@/shared/lib/period"

/**
 * RF-10: a report always answers for one month, a chosen range of months, or
 * every month ever registered. The three cases are incompatible, so they stay
 * as a discriminated union instead of optional bounds.
 */
export type ReportScope =
  | { kind: "month"; period: Period }
  | { kind: "range"; start: Period; end: Period }
  | { kind: "all" }

const MONTHS_PER_YEAR = 12

const toMonthIndex = ({ year, month }: Period): number =>
  year * MONTHS_PER_YEAR + (month - 1)

export const isPeriodBefore = (left: Period, right: Period): boolean =>
  toMonthIndex(left) < toMonthIndex(right)

export const isPeriodInScope = (
  period: Period,
  scope: ReportScope
): boolean => {
  if (scope.kind === "all") {
    return true
  }

  if (scope.kind === "month") {
    return toMonthIndex(period) === toMonthIndex(scope.period)
  }

  return (
    toMonthIndex(period) >= toMonthIndex(scope.start) &&
    toMonthIndex(period) <= toMonthIndex(scope.end)
  )
}

/**
 * Postgres cannot compare the (year, month) pair with the query builder, so
 * the query narrows by year and `isPeriodInScope` trims the edge months.
 */
export const scopeYearBounds = (
  scope: ReportScope
): { minYear: number | null; maxYear: number | null } => {
  if (scope.kind === "all") {
    return { minYear: null, maxYear: null }
  }

  if (scope.kind === "month") {
    return { minYear: scope.period.year, maxYear: scope.period.year }
  }

  return { minYear: scope.start.year, maxYear: scope.end.year }
}

export const formatScopeLabel = (scope: ReportScope): string => {
  if (scope.kind === "all") {
    return "Todo el historial"
  }

  if (scope.kind === "month") {
    return formatPeriodLabel(scope.period)
  }

  return `${formatPeriodLabel(scope.start)} a ${formatPeriodLabel(scope.end)}`
}

/** Distinguishes cache entries: two scopes never share queried data. */
export const scopeCacheKey = (scope: ReportScope): string => {
  if (scope.kind === "all") {
    return "all"
  }

  if (scope.kind === "month") {
    return `month:${scope.period.year}-${scope.period.month}`
  }

  return `range:${scope.start.year}-${scope.start.month}:${scope.end.year}-${scope.end.month}`
}
