export type Period = {
  year: number
  /** Calendar month, 1-indexed (1 = January). */
  month: number
}

const MONTHS_PER_YEAR = 12

// The clock is injected so callers and tests can decide "today" explicitly.
export const getCurrentPeriod = (now: Date = new Date()): Period => ({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
})

export const addMonths = (period: Period, amount: number): Period => {
  const monthIndex = period.year * MONTHS_PER_YEAR + (period.month - 1) + amount

  return {
    year: Math.floor(monthIndex / MONTHS_PER_YEAR),
    month: (monthIndex % MONTHS_PER_YEAR) + 1,
  }
}

export const isSamePeriod = (left: Period, right: Period) =>
  left.year === right.year && left.month === right.month

export const parsePeriod = (
  year: string | undefined,
  month: string | undefined
): Period | null => {
  if (year === undefined || month === undefined) {
    return null
  }

  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) {
    return null
  }

  const parsedYear = Number(year)
  const parsedMonth = Number(month)

  if (parsedMonth < 1 || parsedMonth > MONTHS_PER_YEAR) {
    return null
  }

  return { year: parsedYear, month: parsedMonth }
}

const periodLabelFormatter = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export const formatPeriodLabel = ({ year, month }: Period) => {
  // UTC keeps the month from shifting backwards in negative-offset time zones.
  const label = periodLabelFormatter.format(Date.UTC(year, month - 1, 1))

  return label.charAt(0).toUpperCase() + label.slice(1)
}
