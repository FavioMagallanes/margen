import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"

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
