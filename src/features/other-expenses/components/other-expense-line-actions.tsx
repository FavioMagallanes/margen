import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/features/auth/use-auth"
import type { Period } from "@/shared/lib/period"

import {
  DELETE_ERROR_MESSAGE,
  UPDATE_ERROR_MESSAGE,
  useDeleteOtherExpenseMutation,
  useUpdateOtherExpenseMutation,
} from "../api/other-expense-mutations"
import {
  type OtherExpenseRow,
  useOtherExpenseConceptsQuery,
  useOtherExpensesQuery,
} from "../api/other-expense-queries"
import {
  formatOtherExpenseAmountInput,
  fromStoredPaymentMethod,
  type OtherExpenseFormValues,
} from "../model/other-expense-form"
import { toExpenseValues } from "../model/other-expense-values"
import { OtherExpenseForm } from "./other-expense-form"

const LOADING_MESSAGE = "Cargando el gasto…"

const UNAVAILABLE_MESSAGE =
  "No pudimos cargar los datos de este gasto. Cerrá el diálogo e intentá de nuevo."

const buildEditDefaults = (row: OtherExpenseRow): OtherExpenseFormValues => ({
  concept: row.concept,
  amount: formatOtherExpenseAmountInput(row.amount),
  // An unsupported stored currency falls back to the proposed one (RF-04).
  currency: row.currency ?? "ars",
  ...fromStoredPaymentMethod(row.paymentMethod),
})

type OtherExpenseEditDialogProps = {
  period: Period
  expenseId: string
  onClose: () => void
}

/**
 * The budget line only carries the expense id, so its editable values are read
 * from the feature's own query instead of being rebuilt from the summary row.
 */
const OtherExpenseEditDialog = ({
  period,
  expenseId,
  onClose,
}: OtherExpenseEditDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const otherExpensesQuery = useOtherExpensesQuery(userId, period)
  const conceptsQuery = useOtherExpenseConceptsQuery(userId)
  const updateOtherExpense = useUpdateOtherExpenseMutation(userId)

  const row = (otherExpensesQuery.data ?? []).find(
    (expense) => expense.id === expenseId
  )

  const handleUpdate = (
    values: OtherExpenseFormValues,
    expense: OtherExpenseRow
  ) => {
    const expenseValues = toExpenseValues(values)

    if (expenseValues === null) {
      return
    }

    updateOtherExpense.mutate(
      { ...expenseValues, id: expense.id },
      { onSuccess: onClose }
    )
  }

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
          <DialogTitle>
            {row === undefined ? "Editar gasto" : `Editar «${row.concept}»`}
          </DialogTitle>
        </DialogHeader>

        {otherExpensesQuery.isLoading ? (
          <p role="status">{LOADING_MESSAGE}</p>
        ) : row === undefined ? (
          <Alert variant="destructive">
            <AlertDescription>{UNAVAILABLE_MESSAGE}</AlertDescription>
          </Alert>
        ) : (
          <OtherExpenseForm
            mode="edit"
            defaultValues={buildEditDefaults(row)}
            conceptSuggestions={conceptsQuery.data ?? []}
            period={period}
            isSaving={updateOtherExpense.isPending}
            errorMessage={
              updateOtherExpense.isError ? UPDATE_ERROR_MESSAGE : null
            }
            onSubmit={(values) => handleUpdate(values, row)}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type OtherExpenseLineActionsProps = {
  period: Period
  expenseId: string
  concept: string
}

/**
 * The actions an "other expense" line of the month offers. They live in this
 * feature so the budget never needs to know how the expense is edited.
 */
export const OtherExpenseLineActions = ({
  period,
  expenseId,
  concept,
}: OtherExpenseLineActionsProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const deleteOtherExpense = useDeleteOtherExpenseMutation(userId)

  const [isEditing, setIsEditing] = useState(false)
  // The confirmation owns its own state, so the dialog only closes once the
  // delete actually succeeded.
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  return (
    <span className="flex items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsEditing(true)}
      >
        Editar
      </Button>

      {isEditing ? (
        <OtherExpenseEditDialog
          period={period}
          expenseId={expenseId}
          onClose={() => setIsEditing(false)}
        />
      ) : null}

      <AlertDialog
        open={isConfirmingDelete}
        onOpenChange={(open) => setIsConfirmingDelete(open)}
      >
        <AlertDialogTrigger
          render={<Button type="button" size="sm" variant="ghost" />}
        >
          Eliminar
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a borrar «{concept}» de este mes. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteOtherExpense.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{DELETE_ERROR_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteOtherExpense.isPending}
              onClick={() =>
                deleteOtherExpense.mutate(expenseId, {
                  onSuccess: () => setIsConfirmingDelete(false),
                })
              }
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
}
