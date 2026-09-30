import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/features/auth/use-auth"
import {
  type DuplicateCandidate,
  findPossibleDuplicate,
} from "@/shared/lib/duplicate-expense"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"

import {
  CREATE_ERROR_MESSAGE,
  useCreateRecurringMutation,
} from "../api/recurring-expense-mutations"
import { useRecurringOccurrencesQuery } from "../api/recurring-expense-queries"
import {
  toRecurringCandidates,
  toRecurringDraftCandidate,
} from "../model/recurring-duplicates"
import {
  type CreateRecurringPlanInput,
  type RecurringFormValues,
  toCreateRecurringPlanInput,
} from "../model/recurring-expense-form"
import { DuplicateRecurringDialog } from "./duplicate-recurring-dialog"
import { RecurringExpenseForm } from "./recurring-expense-form"

type RecurringCreateDialogProps = {
  /** RF-05: a new recurring expense starts in the month on screen. */
  period: Period
  onClose: () => void
}

const LOADING_MESSAGE = "Cargando los recurrentes del mes…"

/** A recurring expense waiting for the duplicate warning answer (RF-09). */
type PendingRecurring = {
  input: CreateRecurringPlanInput
  keepFormOpen: boolean
  duplicate: DuplicateCandidate
}

const buildCreateDefaults = (): RecurringFormValues => ({
  concept: "",
  groupLabel: "Otros gastos",
  currency: "ars",
  amountMode: "fixed",
  startingAmount: "",
  duration: "untilStopped",
  totalMonths: "12",
})

/**
 * RF-05 / RF-09: creating a recurring expense from the budget month, with the
 * same form, validation and duplicate warning the feature already owned.
 */
export const RecurringCreateDialog = ({
  period,
  onClose,
}: RecurringCreateDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const occurrencesQuery = useRecurringOccurrencesQuery(userId, period)
  const createRecurring = useCreateRecurringMutation(userId)

  const [pendingCreate, setPendingCreate] = useState<PendingRecurring | null>(
    null
  )
  // RF-09: remounting the create form is what resets it to its defaults, so
  // nothing survives the previous load.
  const [createFormKey, setCreateFormKey] = useState(0)

  const saveCreate = (
    input: CreateRecurringPlanInput,
    keepFormOpen: boolean
  ) => {
    createRecurring.mutate(
      { ...input, period },
      {
        onSuccess: () => {
          if (keepFormOpen) {
            setCreateFormKey((key) => key + 1)
            return
          }

          onClose()
        },
      }
    )
  }

  const handleCreate = (values: RecurringFormValues, keepFormOpen: boolean) => {
    const input = toCreateRecurringPlanInput(values)

    if (input === null) {
      return
    }

    const duplicate = findPossibleDuplicate(
      toRecurringDraftCandidate(input),
      toRecurringCandidates(occurrencesQuery.data ?? [])
    )

    if (duplicate !== null) {
      setPendingCreate({ input, keepFormOpen, duplicate })
      return
    }

    saveCreate(input, keepFormOpen)
  }

  const confirmPendingCreate = () => {
    if (pendingCreate === null) {
      return
    }

    setPendingCreate(null)
    saveCreate(pendingCreate.input, pendingCreate.keepFormOpen)
  }

  return (
    <>
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
            <DialogTitle>Nuevo recurrente</DialogTitle>
            <DialogDescription>
              Empieza en {formatPeriodLabel(period)}.
            </DialogDescription>
          </DialogHeader>

          {occurrencesQuery.isLoading ? (
            // RF-09: the duplicate warning compares against the recurring
            // expenses already generated in the month, so the form only opens
            // once they are known.
            <p role="status">{LOADING_MESSAGE}</p>
          ) : (
            <RecurringExpenseForm
              key={createFormKey}
              defaultValues={buildCreateDefaults()}
              period={period}
              isSaving={createRecurring.isPending}
              errorMessage={
                createRecurring.isError ? CREATE_ERROR_MESSAGE : null
              }
              onSubmit={(values) => handleCreate(values, false)}
              onSubmitAndAddAnother={(values) => handleCreate(values, true)}
              onCancel={onClose}
            />
          )}
        </DialogContent>
      </Dialog>

      <DuplicateRecurringDialog
        duplicate={pendingCreate?.duplicate ?? null}
        onReview={() => setPendingCreate(null)}
        onSaveAnyway={confirmPendingCreate}
      />
    </>
  )
}
