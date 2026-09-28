import { Decimal } from "decimal.js"

/**
 * Live formatting for amount fields: thousands grouped with "." and at most two
 * decimals after ",", the way amounts are written in Argentina. It is shared
 * because every amount the app loads (sueldo, cuotas, préstamos, recurrentes)
 * has to be typed the same way.
 */

const MAX_DECIMAL_DIGITS = 2

const digitsOf = (value: string): string => value.replace(/\D/g, "")

const groupThousands = (integerDigits: string): string =>
  integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")

/**
 * "," is always the decimal separator. A "." only becomes one when the user
 * just typed it at the end: any other "." is a thousands separator this same
 * function inserted, so deleting a digit from "1.500" still reads as 150 and
 * not as 1,50.
 */
const decimalMarkerIndexOf = (sanitizedValue: string): number | null => {
  const lastComma = sanitizedValue.lastIndexOf(",")

  if (lastComma !== -1) {
    return lastComma
  }

  return sanitizedValue.endsWith(".") ? sanitizedValue.length - 1 : null
}

export const formatAmountInputValue = (rawValue: string): string => {
  const sanitizedValue = rawValue.replace(/[^\d.,]/g, "")
  const markerIndex = decimalMarkerIndexOf(sanitizedValue)

  const integerDigits = digitsOf(
    markerIndex === null ? sanitizedValue : sanitizedValue.slice(0, markerIndex)
  ).replace(/^0+(?=\d)/, "")

  if (markerIndex === null) {
    return integerDigits === "" ? "" : groupThousands(integerDigits)
  }

  const decimalDigits = digitsOf(sanitizedValue.slice(markerIndex + 1)).slice(
    0,
    MAX_DECIMAL_DIGITS
  )

  return `${groupThousands(integerDigits === "" ? "0" : integerDigits)},${decimalDigits}`
}

/**
 * Parses what the field shows (or what the user just typed) into a Decimal.
 * The value is normalised through formatAmountInputValue first, so screen and
 * form validation never disagree about what an amount means.
 */
export const parseAmountInputValue = (
  formattedOrRawValue: string
): Decimal | null => {
  const formattedValue = formatAmountInputValue(formattedOrRawValue)
  const plainValue = formattedValue
    .replaceAll(".", "")
    .replace(",", ".")
    .replace(/\.$/, "")

  return plainValue === "" ? null : new Decimal(plainValue)
}

const countDigits = (value: string): number => digitsOf(value).length

/**
 * Keeps the caret next to the digit the user just typed or deleted instead of
 * letting it jump to the end every time a separator is inserted or removed:
 * the caret is placed after the same amount of digits it had before formatting.
 */
export const computeCaretIndexAfterFormat = (
  previousRawValue: string,
  previousCaretIndex: number,
  nextFormattedValue: string
): number => {
  const clampedCaretIndex = Math.min(
    Math.max(previousCaretIndex, 0),
    previousRawValue.length
  )
  const digitsBeforeCaret = countDigits(
    previousRawValue.slice(0, clampedCaretIndex)
  )

  if (digitsBeforeCaret === 0) {
    return 0
  }

  let passedDigits = 0

  for (let index = 0; index < nextFormattedValue.length; index += 1) {
    if (/\d/.test(nextFormattedValue.charAt(index))) {
      passedDigits += 1

      if (passedDigits === digitsBeforeCaret) {
        return index + 1
      }
    }
  }

  return nextFormattedValue.length
}
