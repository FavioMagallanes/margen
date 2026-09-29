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
