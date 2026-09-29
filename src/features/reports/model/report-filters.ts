import {
  isReportCurrency,
  type ReportCurrency,
  type ReportExpenseKind,
  type ReportExpenseLine,
} from "./report-line"

/**
 * RF-10: the four filters of the report. An empty list means «no restriction»
 * for that filter, so the default state shows everything the scope brought.
 */
export type ReportFilters = {
  concept: string
  kinds: readonly ReportExpenseKind[]
  groups: readonly string[]
  currencies: readonly ReportCurrency[]
}

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  concept: "",
  kinds: [],
  groups: [],
  currencies: [],
}

/**
 * Same criterion as `shared/lib/duplicate-expense.ts`: the concept is free
 * text, so surrounding spaces and casing never decide a match.
 */
const normalizeConcept = (concept: string): string =>
  concept.trim().toLowerCase()

const matchesConcept = (line: ReportExpenseLine, concept: string): boolean => {
  const searched = normalizeConcept(concept)

  return searched === "" || normalizeConcept(line.concept).includes(searched)
}

const matchesCurrency = (
  line: ReportExpenseLine,
  currencies: readonly ReportCurrency[]
): boolean => {
  if (currencies.length === 0) {
    return true
  }

  // An unsupported stored currency belongs to neither ARS nor USD, so a
  // currency filter leaves it out instead of guessing one.
  return isReportCurrency(line.currency) && currencies.includes(line.currency)
}

export const applyReportFilters = (
  lines: readonly ReportExpenseLine[],
  filters: ReportFilters
): ReportExpenseLine[] =>
  lines.filter(
    (line) =>
      matchesConcept(line, filters.concept) &&
      (filters.kinds.length === 0 || filters.kinds.includes(line.kind)) &&
      (filters.groups.length === 0 || filters.groups.includes(line.group)) &&
      matchesCurrency(line, filters.currencies)
  )

export const hasActiveFilters = (filters: ReportFilters): boolean =>
  normalizeConcept(filters.concept) !== "" ||
  filters.kinds.length > 0 ||
  filters.groups.length > 0 ||
  filters.currencies.length > 0

/** The group options come from the scope's own data, never from a fixed list. */
export const collectGroupLabels = (
  lines: readonly ReportExpenseLine[]
): string[] => {
  const groups: string[] = []

  for (const line of lines) {
    if (!groups.includes(line.group)) {
      groups.push(line.group)
    }
  }

  return groups.sort((left, right) => left.localeCompare(right, "es-AR"))
}

/** Toggling one option of a multi-selection filter, without mutating it. */
export const toggleFilterOption = <TOption extends string>(
  options: readonly TOption[],
  option: TOption
): TOption[] =>
  options.includes(option)
    ? options.filter((current) => current !== option)
    : [...options, option]
