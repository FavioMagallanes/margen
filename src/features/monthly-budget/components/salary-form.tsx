import { Controller, useForm } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { parseAmountInputValue } from "@/shared/lib/amount-input"
import { AmountInput } from "@/shared/ui/amount-input"

import { type SalaryFormValues, salaryResolver } from "../model/salary-form"

type SalaryFormProps = {
  defaultSalary: string
  isSaving: boolean
  hasFailed: boolean
  onSave: (salaryArs: number) => void
}

const SAVE_ERROR_MESSAGE =
  "No pudimos guardar el sueldo. Intentá de nuevo en un momento."

export const SalaryForm = ({
  defaultSalary,
  isSaving,
  hasFailed,
  onSave,
}: SalaryFormProps) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SalaryFormValues>({
    resolver: salaryResolver,
    defaultValues: { salary: defaultSalary },
  })

  const onSubmit = handleSubmit(({ salary }) => {
    const salaryArs = parseAmountInputValue(salary)

    // The resolver already rejected an unparseable salary; this only narrows it.
    if (salaryArs === null) {
      return
    }

    onSave(salaryArs.toNumber())
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <Label htmlFor="monthly-salary" className="text-muted-foreground">
        Sueldo del mes
      </Label>

      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name="salary"
          render={({ field }) => (
            <AmountInput
              id="monthly-salary"
              autoComplete="off"
              className="w-48 font-mono"
              aria-invalid={errors.salary !== undefined}
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onValueChange={(formattedValue) => field.onChange(formattedValue)}
            />
          )}
        />
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar sueldo"}
        </Button>
      </div>

      {errors.salary ? (
        <p role="alert" className="text-xs text-destructive">
          {errors.salary.message}
        </p>
      ) : null}

      {hasFailed ? (
        <Alert variant="destructive">
          <AlertDescription>{SAVE_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  )
}
