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
  type OtherExpenseValues,
  useCreateOtherExpenseMutation,
} from "../api/other-expense-mutations"
import {
  useOtherExpenseConceptsQuery,
  useOtherExpensesQuery,
} from "../api/other-expense-queries"
import {
  toOtherExpenseCandidates,
  toOtherExpenseDraftCandidate,
} from "../model/other-expense-duplicates"
import type { OtherExpenseFormValues } from "../model/other-expense-form"
import { toExpenseValues } from "../model/other-expense-values"
import { DuplicateOtherExpenseDialog } from "./duplicate-other-expense-dialog"
import { OtherExpenseForm } from "./other-expense-form"

type OtherExpenseCreateDialogProps = {
  /** RF-04: an expense is always imputed to the month on screen. */
  period: Period
  onClose: () => void
}

const LOADING_MESSAGE = "Cargando los gastos del mes…"

/** An expense waiting for the user to answer the duplicate warning (RF-09). */
type PendingOtherExpense = {
  values: OtherExpenseValues
  keepFormOpen: boolean
  duplicate: DuplicateCandidate
}

const buildCreateDefaults = (): OtherExpenseFormValues => ({
  concept: "",
  amount: "",
  currency: "ars",
  paymentMethod: "none",
  paymentMethodText: "",
})

/**
 * RF-04 / RF-09: loading a one-off expense from the budget month, with the
 * same form, validation and duplicate warning the feature already owned.
 */
export const OtherExpenseCreateDialog = ({
  period,
  onClose,
}: OtherExpenseCreateDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const otherExpensesQuery = useOtherExpensesQuery(userId, period)
  const conceptsQuery = useOtherExpenseConceptsQuery(userId)
  const createOtherExpense = useCreateOtherExpenseMutation(userId)

  const [pendingCreate, setPendingCreate] =
    useState<PendingOtherExpense | null>(null)
  // RF-09: remounting the create form is what resets it to its defaults, so
  // nothing survives the previous load.
  const [createFormKey, setCreateFormKey] = useState(0)

  const saveCreate = (values: OtherExpenseValues, keepFormOpen: boolean) => {
    createOtherExpense.mutate(
      { ...values, period },
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

  const handleCreate = (
    values: OtherExpenseFormValues,
    keepFormOpen: boolean
  ) => {
    const expenseValues = toExpenseValues(values)

    if (expenseValues === null) {
      return
    }

    const duplicate = findPossibleDuplicate(
      toOtherExpenseDraftCandidate(expenseValues),
      toOtherExpenseCandidates(otherExpensesQuery.data ?? [])
    )

    if (duplicate !== null) {
      setPendingCreate({ values: expenseValues, keepFormOpen, duplicate })
      return
    }

    saveCreate(expenseValues, keepFormOpen)
  }

  const confirmPendingCreate = () => {
    if (pendingCreate === null) {
      return
    }

    setPendingCreate(null)
    saveCreate(pendingCreate.values, pendingCreate.keepFormOpen)
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
            <DialogTitle>Nuevo gasto</DialogTitle>
            <DialogDescription>
              Se imputa a {formatPeriodLabel(period)}.
            </DialogDescription>
          </DialogHeader>

          {otherExpensesQuery.isLoading ? (
            // RF-09: the duplicate warning compares against the expenses
            // already loaded in the month, so the form only opens once they
            // are known.
            <p role="status">{LOADING_MESSAGE}</p>
          ) : (
            <OtherExpenseForm
              key={createFormKey}
              mode="create"
              defaultValues={buildCreateDefaults()}
              conceptSuggestions={conceptsQuery.data ?? []}
              period={period}
              isSaving={createOtherExpense.isLoading}
              errorMessage={
                createOtherExpense.isError ? CREATE_ERROR_MESSAGE : null
              }
              onSubmit={(values) => handleCreate(values, false)}
              onSubmitAndAddAnother={(values) => handleCreate(values, true)}
              onCancel={onClose}
            />
          )}
        </DialogContent>
      </Dialog>

      <DuplicateOtherExpenseDialog
        duplicate={pendingCreate?.duplicate ?? null}
        onReview={() => setPendingCreate(null)}
        onSaveAnyway={confirmPendingCreate}
      />
    </>
  )
}
