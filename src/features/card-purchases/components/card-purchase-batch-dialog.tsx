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
  CREATE_BATCH_ERROR_MESSAGE,
  type CreateCardPurchasesBatchInput,
  useCreateCardPurchasesBatchMutation,
} from "../api/card-purchase-mutations"
import { useCardPurchasesQuery } from "../api/card-purchase-queries"
import { CardPurchaseBatchPanel } from "./card-purchase-batch-panel"

type CardPurchaseBatchDialogProps = {
  /** RF-09: the month is fixed by the budget for the whole batch. */
  period: Period
  onClose: () => void
}

const LOADING_MESSAGE = "Cargando las compras del mes…"

/**
 * RF-09: loading several purchases of the same card at once. It is its own
 * flow, not one more row of the month, so it gets its own dialog.
 */
export const CardPurchaseBatchDialog = ({
  period,
  onClose,
}: CardPurchaseBatchDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const purchasesQuery = useCardPurchasesQuery(userId, period)
  const createPurchasesBatch = useCreateCardPurchasesBatchMutation(userId)

  const saveBatch = (input: CreateCardPurchasesBatchInput) => {
    // A failed batch keeps the panel open with its list intact, so nothing the
    // user already typed is lost.
    createPurchasesBatch.mutate(input, { onSuccess: onClose })
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
          <DialogTitle>Cargar varias compras</DialogTitle>
          <DialogDescription>
            Todas se imputan a {formatPeriodLabel(period)}.
          </DialogDescription>
        </DialogHeader>

        {purchasesQuery.isLoading ? (
          // RF-09: each item is checked against the purchases already loaded
          // in the month, so the list only opens once they are known.
          <p role="status">{LOADING_MESSAGE}</p>
        ) : (
          <CardPurchaseBatchPanel
            period={period}
            existingRows={purchasesQuery.data ?? []}
            isSaving={createPurchasesBatch.isPending}
            errorMessage={
              createPurchasesBatch.isError ? CREATE_BATCH_ERROR_MESSAGE : null
            }
            onSave={(card, items) => saveBatch({ card, period, items })}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
