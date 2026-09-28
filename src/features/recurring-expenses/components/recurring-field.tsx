import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FieldProps = {
  htmlFor: string
  label: string
  children: ReactNode
}

export const Field = ({ htmlFor, label, children }: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={htmlFor} className="text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
)

export const FieldError = ({ message }: { message: string | undefined }) =>
  message === undefined ? null : (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )

export type SelectOption = {
  value: string
  label: string
}

/**
 * The Select root drives the value through `onValueChange` instead of a change
 * event, so every form select needs the same Controller bridge.
 */
export const SelectField = ({
  id,
  options,
  value,
  isInvalid,
  onValueChange,
  onBlur,
}: {
  id: string
  options: readonly SelectOption[]
  value: string
  isInvalid: boolean
  onValueChange: (value: string) => void
  onBlur: () => void
}) => (
  <Select
    items={[...options]}
    value={value}
    onValueChange={(selectedValue) => {
      if (selectedValue !== null) {
        onValueChange(selectedValue)
      }
    }}
  >
    <SelectTrigger
      id={id}
      className="h-7 w-full text-sm md:text-xs/relaxed"
      aria-invalid={isInvalid}
      onBlur={onBlur}
    >
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)
