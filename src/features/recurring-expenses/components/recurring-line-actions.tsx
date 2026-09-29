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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/features/auth/use-auth"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"

import {
  DELETE_ERROR_MESSAGE,
  SET_AMOUNT_ERROR_MESSAGE,
  STOP_ERROR_MESSAGE,
  UPDATE_ERROR_MESSAGE,
  useDeleteRecurringMutation,
  useSetRecurringAmountMutation,
  useStopRecurringMutation,
  useUpdateRecurringMutation,
} from "../api/recurring-expense-mutations"
import { useRecurringOccurrencesQuery } from "../api/recurring-expense-queries"
import {
  formatRecurringAmountInput,
  isRecurringCurrency,
  isRecurringGroup,
  type RecurringCurrency,
  type RecurringEditFormValues,
  type RecurringGroup,
  toRecurringPlanInput,
} from "../model/recurring-expense-form"
import { isStoppedAt, type RecurringRow } from "../model/recurring-plans"
import { RecurringAmountForm } from "./recurring-amount-form"
import { RecurringExpenseEditForm } from "./recurring-expense-edit-form"

const LOADING_MESSAGE = "Cargando el recurrente…"

const UNAVAILABLE_MESSAGE =
  "No pudimos cargar los datos de este recurrente. Cerrá el diálogo e intentá de nuevo."

const NOT_EDITABLE_MESSAGE =
  "Este recurrente tiene una agrupación o una moneda que el formulario no ofrece, así que no se puede editar sin reemplazar ese valor."

/**
 * A row can only be edited while its stored group and currency still belong to
 * the closed lists the form offers: otherwise saving it would silently replace
 * a value the user never chose.
 */
type EditableRecurring = {
  row: RecurringRow
  groupLabel: RecurringGroup
  currency: RecurringCurrency
}

const toEditableRecurring = (row: RecurringRow): EditableRecurring | null => {
  if (!isRecurringGroup(row.groupLabel) || !isRecurringCurrency(row.currency)) {
    return null
  }

  return { row, groupLabel: row.groupLabel, currency: row.currency }
}

const buildEditDefaults = ({
  row,
  groupLabel,
  currency,
}: EditableRecurring): RecurringEditFormValues => ({
  concept: row.concept,
  groupLabel,
  currency,
  amountMode: row.defaultAmount === null ? "variable" : "fixed",
  defaultAmount:
    row.defaultAmount === null
      ? ""
      : formatRecurringAmountInput(row.defaultAmount),
  duration:
    row.totalInstallments === null
      ? "untilStopped"
      : row.totalInstallments === 1
        ? "once"
        : "months",
  totalMonths:
    row.totalInstallments === null ? "12" : String(row.totalInstallments),
})

type RecurringDialogProps = {
  period: Period
  planId: string
  onClose: () => void
}

/**
 * The budget line only knows which plan it belongs to, so the editable values
 * are read from the feature's own query instead of being rebuilt from the
 * summary row.
 */
const RecurringEditDialog = ({
  period,
  planId,
  onClose,
}: RecurringDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const occurrencesQuery = useRecurringOccurrencesQuery(userId, period)
  const updateRecurring = useUpdateRecurringMutation(userId)

  const row = (occurrencesQuery.data ?? []).find(
    (occurrence) => occurrence.planId === planId
  )
  const editable = row === undefined ? null : toEditableRecurring(row)

  const handleUpdate = (
    values: RecurringEditFormValues,
    recurring: EditableRecurring
  ) => {
    const input = toRecurringPlanInput(values)

    if (input === null) {
      return
    }

    updateRecurring.mutate(
      { ...input, planId: recurring.row.planId, fromPeriod: period },
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
            {row === undefined
              ? "Editar recurrente"
              : `Editar «${row.concept}»`}
          </DialogTitle>
        </DialogHeader>

        {occurrencesQuery.isLoading ? (
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
          <RecurringExpenseEditForm
            defaultValues={buildEditDefaults(editable)}
            editedPeriod={period}
            isSaving={updateRecurring.isLoading}
            errorMessage={updateRecurring.isError ? UPDATE_ERROR_MESSAGE : null}
            onSubmit={(values) => handleUpdate(values, editable)}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** RF-05: the amount of a single generated month, estimated or definitive. */
const RecurringAmountDialog = ({
  period,
  occurrenceId,
  concept,
  onClose,
}: {
  period: Period
  occurrenceId: string
  concept: string
  onClose: () => void
}) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const occurrencesQuery = useRecurringOccurrencesQuery(userId, period)
  const setOccurrenceAmount = useSetRecurringAmountMutation(userId)

  const row = (occurrencesQuery.data ?? []).find(
    (occurrence) => occurrence.occurrenceId === occurrenceId
  )

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
          <DialogTitle>Corregir el importe de «{concept}»</DialogTitle>
        </DialogHeader>

        {occurrencesQuery.isLoading ? (
          <p role="status">{LOADING_MESSAGE}</p>
        ) : row === undefined ? (
          <Alert variant="destructive">
            <AlertDescription>{UNAVAILABLE_MESSAGE}</AlertDescription>
          </Alert>
        ) : (
          <RecurringAmountForm
            concept={concept}
            period={period}
            defaultAmount={
              row.amount === null ? "" : formatRecurringAmountInput(row.amount)
            }
            defaultIsEstimated={row.amountIsEstimated}
            isSaving={setOccurrenceAmount.isLoading}
            errorMessage={
              setOccurrenceAmount.isError ? SET_AMOUNT_ERROR_MESSAGE : null
            }
            onSubmit={(amount, isEstimated) =>
              setOccurrenceAmount.mutate(
                { occurrenceId, amount, isEstimated },
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

type RecurringLineActionsProps = {
  period: Period
  planId: string
  /** The generated month behind the budget line, which owns its amount. */
  occurrenceId: string
  concept: string
}

/**
 * The actions a recurring line of the month offers. They live in this feature
 * so the budget never needs to know how a recurring plan is edited, stopped or
 * deleted.
 */
export const RecurringLineActions = ({
  period,
  planId,
  occurrenceId,
  concept,
}: RecurringLineActionsProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const stopRecurring = useStopRecurringMutation(userId)
  const deleteRecurring = useDeleteRecurringMutation(userId)
  // Shares the same cache entry every other line of this month's plan already
  // uses, so viewing several recurring lines never adds an extra request.
  const occurrencesQuery = useRecurringOccurrencesQuery(userId, period)
  const row = (occurrencesQuery.data ?? []).find(
    (occurrence) => occurrence.planId === planId
  )
  const isStopped = isStoppedAt(row?.stoppedFrom ?? null, period)

  const [openDialog, setOpenDialog] = useState<"none" | "edit" | "amount">(
    "none"
  )
  // Each confirmation owns its state, so a dialog only closes once its action
  // actually succeeded.
  const [isConfirmingStop, setIsConfirmingStop] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const closeDialog = () => setOpenDialog("none")
  const periodLabel = formatPeriodLabel(period)

  return (
    <span className="flex items-center justify-end gap-2">
      {isStopped ? <Badge variant="outline">Detenido</Badge> : null}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpenDialog("amount")}
      >
        Corregir importe
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpenDialog("edit")}
      >
        Editar
      </Button>

      {openDialog === "edit" ? (
        <RecurringEditDialog
          period={period}
          planId={planId}
          onClose={closeDialog}
        />
      ) : null}

      {openDialog === "amount" ? (
        <RecurringAmountDialog
          period={period}
          occurrenceId={occurrenceId}
          concept={concept}
          onClose={closeDialog}
        />
      ) : null}

      <AlertDialog
        open={isConfirmingStop}
        onOpenChange={(open) => setIsConfirmingStop(open)}
      >
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isStopped}
            />
          }
        >
          Detener
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Detener este recurrente?</AlertDialogTitle>
            <AlertDialogDescription>
              «{concept}» deja de ofrecerse desde {periodLabel} en adelante. Los
              meses que ya generaste se mantienen como están.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {stopRecurring.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{STOP_ERROR_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={stopRecurring.isLoading}
              onClick={() =>
                stopRecurring.mutate(
                  { planId, fromPeriod: period },
                  { onSuccess: () => setIsConfirmingStop(false) }
                )
              }
            >
              Sí, detener
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogTitle>¿Eliminar este recurrente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se van a borrar todos los meses de «{concept}», pasados y futuros.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteRecurring.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{DELETE_ERROR_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteRecurring.isLoading}
              onClick={() =>
                deleteRecurring.mutate(planId, {
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
