/** One installment of a loan, as this month's list needs to show it. */
export type LoanRow = {
  occurrenceId: string
  planId: string
  entity: string
  conceptText: string
  installmentNumber: number | null
  totalInstallments: number | null
  /** Null until the user completes it: RF-03 forbids reading it as zero. */
  amount: number | null
}

export type LoanGroup = {
  entity: string
  rows: LoanRow[]
}

const byEntityThenConcept = (left: LoanRow, right: LoanRow) =>
  left.entity.localeCompare(right.entity, "es-AR") ||
  left.conceptText.localeCompare(right.conceptText, "es-AR")

/**
 * Groups the month's installments by entity. Only the entities with at least
 * one loan this month end up in the result, so the page never renders an empty
 * entity heading.
 */
export const groupLoansByEntity = (rows: readonly LoanRow[]): LoanGroup[] => {
  const groups: LoanGroup[] = []

  for (const row of [...rows].sort(byEntityThenConcept)) {
    const group = groups.find((candidate) => candidate.entity === row.entity)

    if (group === undefined) {
      groups.push({ entity: row.entity, rows: [row] })
      continue
    }

    group.rows.push(row)
  }

  return groups
}

export const isLastInstallment = ({
  installmentNumber,
  totalInstallments,
}: LoanRow): boolean =>
  installmentNumber !== null &&
  totalInstallments !== null &&
  installmentNumber === totalInstallments
