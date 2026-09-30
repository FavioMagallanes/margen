import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/features/auth/use-auth"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"

import {
  GENERATE_ERROR_MESSAGE,
  useGenerateRecurringOccurrencesMutation,
} from "../api/recurring-expense-mutations"
import { useRecurringPlansQuery } from "../api/recurring-expense-queries"
import { toPendingRecurringPlans } from "../model/recurring-plans"
import { RecurringGenerationForm } from "./recurring-generation-form"

const LOADING_MESSAGE = "Cargando los recurrentes activos…"

type RecurringGenerationDialogProps = {
  period: Period
  onClose: () => void
}

/**
 * RF-05: generating the recurring expenses of a month is an explicit action,
 * never a side effect of opening the budget, so it keeps its own entry point
 * and its own dialog.
 */
export const RecurringGenerationDialog = ({
  period,
  onClose,
}: RecurringGenerationDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const plansQuery = useRecurringPlansQuery(userId)
  const generateOccurrences = useGenerateRecurringOccurrencesMutation(userId)

  const periodLabel = formatPeriodLabel(period)
  // A pure read: which plans the explicit generation would offer for this
  // month. Opening the dialog never writes any of them (AGENTS.md).
  const pendingPlans = toPendingRecurringPlans(plansQuery.data ?? [], period)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Generar recurrentes de {periodLabel}</DialogTitle>
          <DialogDescription>
            Elegí cuáles se cargan en el mes y con qué importe.
          </DialogDescription>
        </DialogHeader>

        {plansQuery.isLoading ? (
          <p role="status">{LOADING_MESSAGE}</p>
        ) : pendingPlans.length === 0 ? (
          <p className="text-base text-foreground">
            No hay recurrentes activos pendientes de generar en {periodLabel}.
          </p>
        ) : (
          <RecurringGenerationForm
            plans={pendingPlans}
            period={period}
            isSaving={generateOccurrences.isPending}
            errorMessage={
              generateOccurrences.isError ? GENERATE_ERROR_MESSAGE : null
            }
            onSubmit={(items) =>
              generateOccurrences.mutate(
                { period, items },
                { onSuccess: onClose }
              )
            }
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
