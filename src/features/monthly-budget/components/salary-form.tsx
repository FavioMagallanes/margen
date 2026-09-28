import { useForm } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  parseSalaryArs,
  type SalaryFormValues,
  salaryResolver,
} from "../model/salary-form"

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
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SalaryFormValues>({
    resolver: salaryResolver,
    defaultValues: { salary: defaultSalary },
  })

  const onSubmit = handleSubmit(({ salary }) => {
    onSave(parseSalaryArs(salary))
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <Label htmlFor="monthly-salary" className="text-muted-foreground">
        Sueldo del mes
      </Label>

      <div className="flex items-start gap-2">
        <Input
          id="monthly-salary"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="w-48 font-mono"
          aria-invalid={errors.salary !== undefined}
          {...register("salary")}
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
