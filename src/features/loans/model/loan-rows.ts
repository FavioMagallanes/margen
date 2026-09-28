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

const byEntityThenConcept = (left: LoanRow, right: LoanRow) =>
  left.entity.localeCompare(right.entity, "es-AR") ||
  left.conceptText.localeCompare(right.conceptText, "es-AR")

export const sortLoanRows = (rows: readonly LoanRow[]): LoanRow[] =>
  [...rows].sort(byEntityThenConcept)

export const isLastInstallment = ({
  installmentNumber,
  totalInstallments,
}: LoanRow): boolean =>
  installmentNumber !== null &&
  totalInstallments !== null &&
  installmentNumber === totalInstallments
