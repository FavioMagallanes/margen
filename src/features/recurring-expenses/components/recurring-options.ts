import {
  RECURRING_CURRENCY_OPTIONS,
  RECURRING_GROUP_OPTIONS,
} from "../model/recurring-expense-form"
import type { SelectOption } from "./recurring-field"

/** The UI copy of the closed lists both recurring forms offer. */
export const groupOptions: readonly SelectOption[] =
  RECURRING_GROUP_OPTIONS.map((group) => ({ value: group, label: group }))

const CURRENCY_LABELS: Record<
  (typeof RECURRING_CURRENCY_OPTIONS)[number],
  string
> = {
  ars: "Pesos (ARS)",
  usd: "Dólares (USD)",
}

export const currencyOptions: readonly SelectOption[] =
  RECURRING_CURRENCY_OPTIONS.map((currency) => ({
    value: currency,
    label: CURRENCY_LABELS[currency],
  }))

export const amountModeOptions: readonly SelectOption[] = [
  { value: "fixed", label: "Fijo todos los meses" },
  { value: "variable", label: "Variable, se carga cada mes" },
]

export const durationOptions: readonly SelectOption[] = [
  { value: "once", label: "Una sola vez" },
  { value: "months", label: "Cantidad fija de meses" },
  { value: "untilStopped", label: "Mensual hasta detener" },
]
