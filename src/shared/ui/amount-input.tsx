import type { Decimal } from "decimal.js"
import type { ChangeEvent, ComponentProps } from "react"

import { Input } from "@/components/ui/input"
import {
  computeCaretIndexAfterFormat,
  formatAmountInputValue,
  parseAmountInputValue,
} from "@/shared/lib/amount-input"

type AmountInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type"
> & {
  value: string
  onValueChange: (formattedValue: string, parsedValue: Decimal | null) => void
}

export const AmountInput = ({
  value,
  onValueChange,
  ...inputProps
}: AmountInputProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const rawValue = input.value
    const formattedValue = formatAmountInputValue(rawValue)
    const caretIndex = computeCaretIndexAfterFormat(
      rawValue,
      input.selectionStart ?? rawValue.length,
      formattedValue
    )

    // The DOM node is written before React re-renders: the separators must be
    // in place when the caret is restored, and React keeps the value it already
    // matches, so the caret survives the render instead of jumping to the end.
    input.value = formattedValue
    input.setSelectionRange(caretIndex, caretIndex)

    onValueChange(formattedValue, parseAmountInputValue(formattedValue))
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      {...inputProps}
    />
  )
}
