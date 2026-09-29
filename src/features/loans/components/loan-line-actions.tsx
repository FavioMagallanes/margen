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
import { parseAmountInputValue } from "@/shared/lib/amount-input"
import type { Period } from "@/shared/lib/period"

import {
  DELETE_ERROR_MESSAGE,
  SAVE_AMOUNTS_ERROR_MESSAGE,
  UPDATE_ERROR_MESSAGE,
  type UpdateLoanInput,
  useDeleteLoanMutation,
  useSetLoanInstallmentAmountsMutation,
  useUpdateLoanMutation,
} from "../api/loan-mutations"
import {
  useLoansQuery,
  usePendingLoanInstallmentsQuery,
} from "../api/loan-queries"
import {
  formatLoanAmountInput,
  type LoanEditFormValues,
  parsePositiveInteger,
} from "../model/loan-form"
import { countMissingInstallmentsUpTo } from "../model/loan-installment-amounts"
import type { LoanRow } from "../model/loan-rows"
import { LoanEditForm } from "./loan-edit-form"
import { LoanInstallmentAmountsForm } from "./loan-installment-amounts-form"

const LOADING_MESSAGE = "Cargando el préstamo…"

const UNAVAILABLE_MESSAGE =
  "No pudimos cargar los datos de este préstamo. Cerrá el diálogo e intentá de nuevo."

const NOT_EDITABLE_MESSAGE =
  "Esta cuota no tiene número de cuota cargado, así que el préstamo no se puede editar sin reescribirlo."

/**
 * A row can only be edited when it still fits the form: a missing installment
 * number would silently rewrite the loan with values the user never chose.
 */
type EditableLoan = {
  row: LoanRow
  installmentNumber: number
  totalInstallments: number
}

const toEditableLoan = (row: LoanRow): EditableLoan | null => {
  if (row.installmentNumber === null || row.totalInstallments === null) {
    return null
  }

  return {
    row,
    installmentNumber: row.installmentNumber,
    totalInstallments: row.totalInstallments,
  }
}

const buildEditDefaults = (loan: EditableLoan): LoanEditFormValues => ({
  concept: loan.row.conceptText,
  entity: loan.row.entity,
  totalInstallments: String(loan.totalInstallments),
  quotaAmount:
    loan.row.amount === null ? "" : formatLoanAmountInput(loan.row.amount),
  editedInstallment: String(loan.installmentNumber),
})

const toUpdateInput = (
  values: LoanEditFormValues,
  loan: EditableLoan,
  period: Period
): UpdateLoanInput | null => {
  const totalInstallments = parsePositiveInteger(values.totalInstallments)

  if (totalInstallments === null) {
    return null
  }

  return {
    planId: loan.row.planId,
    concept: values.concept,
    entity: values.entity,
    // P-04: the edit starts at the installment and month of the edited row.
    fromInstallment: loan.installmentNumber,
    fromPeriod: period,
    totalInstallments,
  }
}

type LoanDialogProps = {
  period: Period
  planId: string
  onClose: () => void
}

/**
 * The budget line only knows which plan it belongs to, so the editable values
 * are read from the feature's own query instead of being rebuilt from the
 * summary row.
 */
const LoanEditDialog = ({ period, planId, onClose }: LoanDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const loansQuery = useLoansQuery(userId, period)
  const updateLoan = useUpdateLoanMutation(userId)
  const saveInstallmentAmount = useSetLoanInstallmentAmountsMutation(userId)

  const row = (loansQuery.data ?? []).find((loan) => loan.planId === planId)
  const editable = row === undefined ? null : toEditableLoan(row)

  const handleUpdate = (values: LoanEditFormValues, loan: EditableLoan) => {
    const input = toUpdateInput(values, loan, period)

    if (input === null) {
      return
    }

    // An empty field means "keep the saved amount", so nothing is sent.
    const amount = parseAmountInputValue(values.quotaAmount)

    updateLoan.mutate(input, {
      onSuccess: () => {
        if (amount === null) {
          onClose()

          return
        }

        saveInstallmentAmount.mutate(
          [{ occurrenceId: loan.row.occurrenceId, amount: amount.toNumber() }],
          { onSuccess: onClose }
        )
      },
    })
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
            {row === undefined
              ? "Editar préstamo"
              : `Editar «${row.conceptText}»`}
          </DialogTitle>
        </DialogHeader>

        {loansQuery.isLoading ? (
          <p role="status">{LOADING_MESSAGE}</p>
        ) : row === undefined ? (
          <Alert variant="destructive">
            <AlertDescription>{UNAVAILABLE_MESSAGE}</AlertDescription>
          </Alert>
        ) : editable === null ? (
          <Alert variant="destructive">
            <AlertDescription>{NOT_EDITABLE_MESSAGE}</AlertDescription>
          </Alert>
        ) : (
          <LoanEditForm
            defaultValues={buildEditDefaults(editable)}
            editedPeriod={period}
            isSaving={updateLoan.isLoading || saveInstallmentAmount.isLoading}
            errorMessage={
              updateLoan.isError
                ? UPDATE_ERROR_MESSAGE
                : saveInstallmentAmount.isError
                  ? SAVE_AMOUNTS_ERROR_MESSAGE
                  : null
            }
            onSubmit={(values) => handleUpdate(values, editable)}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * RF-03: the amounts of the installments still pending, which are not asked
 * for when the loan is created.
 */
const LoanInstallmentAmountsDialog = ({
  period,
  planId,
  concept,
  onClose,
}: {
  period: Period
  planId: string
  concept: string
  onClose: () => void
}) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const pendingInstallmentsQuery = usePendingLoanInstallmentsQuery(userId)
  const saveInstallmentAmounts = useSetLoanInstallmentAmountsMutation(userId)

  const installments = (pendingInstallmentsQuery.data ?? []).filter(
    (installment) => installment.planId === planId
  )
  // RF-03: a missing amount in a month that already happened is what makes
  // this loan's subtotal incomplete; a future installment without one yet is
  // expected instead.
  const missingUpToNow = countMissingInstallmentsUpTo(installments, period)

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
          <DialogTitle>Completar próximas cuotas de «{concept}»</DialogTitle>
        </DialogHeader>

        {missingUpToNow === 0 ? null : (
          <Alert>
            <AlertDescription>
              Subtotal incompleto: hay {missingUpToNow}{" "}
              {missingUpToNow === 1 ? "cuota" : "cuotas"} sin importe en este
              préstamo hasta el mes que estás viendo.
            </AlertDescription>
          </Alert>
        )}

        {pendingInstallmentsQuery.isLoading ? (
          <p role="status">{LOADING_MESSAGE}</p>
        ) : (
          <LoanInstallmentAmountsForm
            concept={concept}
            installments={installments}
            isSaving={saveInstallmentAmounts.isLoading}
            errorMessage={
              saveInstallmentAmounts.isError ? SAVE_AMOUNTS_ERROR_MESSAGE : null
            }
            onSubmit={(amounts) =>
              saveInstallmentAmounts.mutate(amounts, { onSuccess: onClose })
            }
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type LoanLineActionsProps = {
  period: Period
  planId: string
  concept: string
}

/**
 * The actions a loan line of the month offers. They live in this feature so
 * the budget never needs to know how a loan is edited.
 */
export const LoanLineActions = ({
  period,
  planId,
  concept,
}: LoanLineActionsProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const deleteLoan = useDeleteLoanMutation(userId)
  const pendingInstallmentsQuery = usePendingLoanInstallmentsQuery(userId)
  // Once every installment of this plan already has an amount, there is
  // nothing left to complete, so the action stops offering it.
  const hasPendingInstallments = (pendingInstallmentsQuery.data ?? []).some(
    (installment) => installment.planId === planId
  )

  const [openDialog, setOpenDialog] = useState<"none" | "edit" | "amounts">(
    "none"
  )
  // The confirmation owns its own state, so the dialog only closes once the
  // delete actually succeeded.
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const closeDialog = () => setOpenDialog("none")

  return (
    <span className="flex items-center justify-end gap-2">
      {hasPendingInstallments ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpenDialog("amounts")}
        >
          Completar próximas cuotas
        </Button>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpenDialog("edit")}
      >
        Editar
      </Button>

      {openDialog === "edit" ? (
        <LoanEditDialog period={period} planId={planId} onClose={closeDialog} />
      ) : null}

      {openDialog === "amounts" ? (
        <LoanInstallmentAmountsDialog
          period={period}
          planId={planId}
          concept={concept}
          onClose={closeDialog}
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
            <AlertDialogTitle>¿Eliminar este préstamo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se van a borrar todas las cuotas de «{concept}», pasadas y
              futuras. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteLoan.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{DELETE_ERROR_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteLoan.isLoading}
              onClick={() =>
                deleteLoan.mutate(planId, {
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
