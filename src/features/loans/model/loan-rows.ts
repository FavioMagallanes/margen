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
