import type { CardPurchaseCurrency } from "./card-purchase-form"

/** One installment of a card purchase, as this month's list needs to show it. */
export type CardPurchaseRow = {
  occurrenceId: string
  planId: string
  card: string
  conceptText: string
  installmentNumber: number | null
  totalInstallments: number | null
  amount: number | null
  currency: CardPurchaseCurrency | null
}

export type CardPurchaseGroup = {
  card: string
  rows: CardPurchaseRow[]
}

const byCardThenConcept = (left: CardPurchaseRow, right: CardPurchaseRow) =>
  left.card.localeCompare(right.card, "es-AR") ||
  left.conceptText.localeCompare(right.conceptText, "es-AR")

/**
 * Groups the month's installments by card. Only the cards with at least one
 * purchase this month end up in the result, so the page never renders an empty
 * card heading.
 */
export const groupPurchasesByCard = (
  rows: readonly CardPurchaseRow[]
): CardPurchaseGroup[] => {
  const groups: CardPurchaseGroup[] = []

  for (const row of [...rows].sort(byCardThenConcept)) {
    const group = groups.find((candidate) => candidate.card === row.card)

    if (group === undefined) {
      groups.push({ card: row.card, rows: [row] })
      continue
    }

    group.rows.push(row)
  }

  return groups
}

export const isLastInstallment = ({
  installmentNumber,
  totalInstallments,
}: CardPurchaseRow): boolean =>
  installmentNumber !== null &&
  totalInstallments !== null &&
  installmentNumber === totalInstallments
