import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"

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
      <label htmlFor="monthly-salary" className="text-xs text-muted-foreground">
        Sueldo del mes
      </label>

      <div className="flex items-start gap-2">
        <input
          id="monthly-salary"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="h-9 w-48 rounded-md border border-border bg-input/30 px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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
        <p role="alert" className="text-xs text-destructive">
          {SAVE_ERROR_MESSAGE}
        </p>
      ) : null}
    </form>
  )
}
