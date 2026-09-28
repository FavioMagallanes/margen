import { Decimal } from "decimal.js"

/**
 * RF-06: every ARS line is rounded to two decimals before the lines are added
 * up, raising the second decimal when the third one is 5 or greater, so the
 * displayed rows always add up to the displayed total.
 */
export const roundArs = (amount: Decimal.Value): Decimal =>
  new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

/** RF-06: a USD consumption becomes an already rounded ARS line. */
export const convertUsdToArs = (
  amountUsd: Decimal.Value,
  arsPerUsd: Decimal.Value
): Decimal => roundArs(new Decimal(amountUsd).times(arsPerUsd))

export const sumArs = (lines: readonly Decimal[]): Decimal =>
  lines.reduce((total, line) => total.plus(line), new Decimal(0))

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatArs = (amount: Decimal.Value): string =>
  arsFormatter.format(new Decimal(amount).toNumber())
