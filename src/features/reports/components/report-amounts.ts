import { Decimal } from "decimal.js"

import { formatArs } from "@/shared/lib/money"

import type { ReportExpenseLine } from "../model/report-line"

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

export const MISSING_AMOUNT_LABEL = "Sin dato"

export const formatUsd = (amount: Decimal.Value): string =>
  usdFormatter.format(new Decimal(amount).toNumber())

/** The amount as it was loaded, in its own currency (RF-06). */
export const formatOriginalAmount = (line: ReportExpenseLine): string => {
  if (line.amount === null) {
    return MISSING_AMOUNT_LABEL
  }

  if (line.currency === "usd") {
    return formatUsd(line.amount)
  }

  if (line.currency === "ars") {
    return formatArs(line.amount)
  }

  return MISSING_AMOUNT_LABEL
}
