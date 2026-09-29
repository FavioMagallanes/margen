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
  UPDATE_ERROR_MESSAGE,
  type UpdateCardPurchaseInput,
  useDeleteCardPurchaseMutation,
  useUpdateCardPurchaseMutation,
} from "../api/card-purchase-mutations"
import { useCardPurchasesQuery } from "../api/card-purchase-queries"
import {
  CARD_OPTIONS,
  type CardOption,
  type CardPurchaseFormValues,
  formatQuotaAmountInput,
  parsePositiveInteger,
} from "../model/card-purchase-form"
import type { CardPurchaseRow } from "../model/card-purchase-groups"
import { CardPurchaseForm } from "./card-purchase-form"

const LOADING_MESSAGE = "Cargando la compra…"

const UNAVAILABLE_MESSAGE =
  "No pudimos cargar los datos de esta compra. Cerrá el diálogo e intentá de nuevo."

const NOT_EDITABLE_MESSAGE =
  "Esta compra tiene datos que el formulario no puede reconstruir (tarjeta o número de cuota), así que no se puede editar sin reescribirla."

/**
 * A row can only be edited when it still fits the form: an unknown card or a
 * missing installment number would silently rewrite the purchase with values
 * the user never chose.
 */
type EditableCardPurchase = {
  row: CardPurchaseRow
  card: CardOption
  installmentNumber: number
  totalInstallments: number
}

const toEditableCardPurchase = (
  row: CardPurchaseRow
): EditableCardPurchase | null => {
  const card = CARD_OPTIONS.find((option) => option === row.card)

  if (
    card === undefined ||
    row.installmentNumber === null ||
    row.totalInstallments === null
  ) {
    return null
  }

  return {
    row,
    card,
    installmentNumber: row.installmentNumber,
    totalInstallments: row.totalInstallments,
  }
}

const buildEditDefaults = (
  purchase: EditableCardPurchase,
  period: Period
): CardPurchaseFormValues => ({
  concept: purchase.row.conceptText,
  card: purchase.card,
  currency: purchase.row.currency ?? "ars",
  quotaAmount:
    purchase.row.amount === null
      ? ""
      : formatQuotaAmountInput(purchase.row.amount),
  isSinglePayment: false,
  startingInstallment: String(purchase.installmentNumber),
  totalInstallments: String(purchase.totalInstallments),
  month: String(period.month),
})

const toUpdateInput = (
  values: CardPurchaseFormValues,
  purchase: EditableCardPurchase,
  period: Period
): UpdateCardPurchaseInput | null => {
  const quotaAmount = parseAmountInputValue(values.quotaAmount)
  const totalInstallments = parsePositiveInteger(values.totalInstallments)

  if (quotaAmount === null || totalInstallments === null) {
    return null
  }

  return {
    planId: purchase.row.planId,
    concept: values.concept,
    card: values.card,
    currency: values.currency,
    quotaAmount: quotaAmount.toNumber(),
    // P-04: the edit starts at the installment and month of the edited row.
    fromInstallment: purchase.installmentNumber,
    fromPeriod: period,
    totalInstallments,
  }
}

type EditDialogProps = {
  period: Period
  planId: string
  onClose: () => void
}

/**
 * The budget line only knows which plan it belongs to, so the editable values
 * are read from the feature's own query instead of being rebuilt from the
 * summary row.
 */
const CardPurchaseEditDialog = ({
  period,
  planId,
  onClose,
}: EditDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const purchasesQuery = useCardPurchasesQuery(userId, period)
  const updatePurchase = useUpdateCardPurchaseMutation(userId)

  const row = (purchasesQuery.data ?? []).find(
    (purchase) => purchase.planId === planId
  )
  const editable = row === undefined ? null : toEditableCardPurchase(row)

  const handleUpdate = (
    values: CardPurchaseFormValues,
    purchase: EditableCardPurchase
  ) => {
    const input = toUpdateInput(values, purchase, period)

    if (input === null) {
      return
    }

    updatePurchase.mutate(input, { onSuccess: onClose })
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
              ? "Editar compra"
              : `Editar «${row.conceptText}»`}
          </DialogTitle>
        </DialogHeader>

        {purchasesQuery.isLoading ? (
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
          <CardPurchaseForm
            mode="edit"
            editedPeriod={period}
            defaultValues={buildEditDefaults(editable, period)}
            isSaving={updatePurchase.isLoading}
            errorMessage={updatePurchase.isError ? UPDATE_ERROR_MESSAGE : null}
            onSubmit={(values) => handleUpdate(values, editable)}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type CardPurchaseLineActionsProps = {
  period: Period
  planId: string
  concept: string
}

/**
 * The actions a card purchase line of the month offers. They live in this
 * feature so the budget never needs to know how a purchase is edited.
 */
export const CardPurchaseLineActions = ({
  period,
  planId,
  concept,
}: CardPurchaseLineActionsProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const deletePurchase = useDeleteCardPurchaseMutation(userId)

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
        <CardPurchaseEditDialog
          period={period}
          planId={planId}
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
            <AlertDialogTitle>¿Eliminar esta compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Se van a borrar todas las cuotas de «{concept}», pasadas y
              futuras. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deletePurchase.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{DELETE_ERROR_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePurchase.isLoading}
              onClick={() =>
                deletePurchase.mutate(planId, {
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
