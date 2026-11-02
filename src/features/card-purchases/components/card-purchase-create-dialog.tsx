import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/features/auth/use-auth"
import { parseAmountInputValue } from "@/shared/lib/amount-input"
import {
  type DuplicateCandidate,
  findPossibleDuplicate,
} from "@/shared/lib/duplicate-expense"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"

import {
  CREATE_ERROR_MESSAGE,
  type CreateCardPurchaseInput,
  useCreateCardPurchaseMutation,
} from "../api/card-purchase-mutations"
import { useCardPurchasesQuery } from "../api/card-purchase-queries"
import {
  toCardPurchaseCandidates,
  toCardPurchaseDraftCandidate,
} from "../model/card-purchase-duplicates"
import {
  type CardPurchaseFormValues,
  parsePositiveInteger,
} from "../model/card-purchase-form"
import { CardPurchaseForm } from "./card-purchase-form"
import { DuplicateCardPurchaseDialog } from "./duplicate-card-purchase-dialog"

type CardPurchaseCreateDialogProps = {
  /** The month being viewed in the budget, which the purchase is imputed to. */
  period: Period
  onClose: () => void
}

const LOADING_MESSAGE = "Cargando las compras del mes…"

/** A purchase waiting for the user to answer the duplicate warning (RF-09). */
type PendingCardPurchase = {
  input: CreateCardPurchaseInput
  keepFormOpen: boolean
  duplicate: DuplicateCandidate
}

const CREATE_DEFAULTS: CardPurchaseFormValues = {
  concept: "",
  card: "BBVA",
  currency: "ars",
  quotaAmount: "",
  isSinglePayment: false,
  startingInstallment: "1",
  totalInstallments: "1",
}

// RF-02: like loans and other expenses, a purchase is always imputed to the
// budget month page it is loaded from, never to the real current month.
const toCreateInput = (
  values: CardPurchaseFormValues,
  period: Period
): CreateCardPurchaseInput | null => {
  const quotaAmount = parseAmountInputValue(values.quotaAmount)
  const startingInstallment = parsePositiveInteger(values.startingInstallment)
  const totalInstallments = parsePositiveInteger(values.totalInstallments)

  // The resolver already rejected these cases; this only narrows the types.
  if (
    quotaAmount === null ||
    startingInstallment === null ||
    totalInstallments === null
  ) {
    return null
  }

  return {
    concept: values.concept,
    card: values.card,
    currency: values.currency,
    quotaAmount: quotaAmount.toNumber(),
    startingInstallment,
    totalInstallments,
    period,
  }
}

/**
 * RF-02 / RF-09: loading a card purchase from the budget month. The form, its
 * validation and its duplicate warning are the same ones the feature already
 * owned; only the place they are mounted from changed.
 */
export const CardPurchaseCreateDialog = ({
  period,
  onClose,
}: CardPurchaseCreateDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const purchasesQuery = useCardPurchasesQuery(userId, period)
  const createPurchase = useCreateCardPurchaseMutation(userId)

  const [pendingCreate, setPendingCreate] =
    useState<PendingCardPurchase | null>(null)
  // RF-09: remounting the create form is what resets it to its defaults, so
  // nothing (not even the installment number) survives the previous load.
  const [createFormKey, setCreateFormKey] = useState(0)

  const saveCreate = (
    input: CreateCardPurchaseInput,
    keepFormOpen: boolean
  ) => {
    createPurchase.mutate(input, {
      onSuccess: () => {
        if (keepFormOpen) {
          setCreateFormKey((key) => key + 1)
          return
        }

        onClose()
      },
    })
  }

  const handleCreate = (
    values: CardPurchaseFormValues,
    keepFormOpen: boolean
  ) => {
    const input = toCreateInput(values, period)

    if (input === null) {
      return
    }

    // The purchase always lands on the viewed month, so the purchases already
    // on screen are exactly the ones it can duplicate.
    const duplicate = findPossibleDuplicate(
      toCardPurchaseDraftCandidate(input),
      toCardPurchaseCandidates(purchasesQuery.data ?? [])
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
            <DialogTitle>Nueva compra con tarjeta</DialogTitle>
            <DialogDescription>
              Se carga sobre {formatPeriodLabel(period)}.
            </DialogDescription>
          </DialogHeader>

          {purchasesQuery.isLoading ? (
            // RF-09: the duplicate warning compares against the purchases
            // already loaded in the month, so the form only opens once they
            // are known instead of saving without that check.
            <p role="status">{LOADING_MESSAGE}</p>
          ) : (
            <CardPurchaseForm
              key={createFormKey}
              mode="create"
              period={period}
              defaultValues={CREATE_DEFAULTS}
              isSaving={createPurchase.isPending}
              errorMessage={
                createPurchase.isError ? CREATE_ERROR_MESSAGE : null
              }
              onSubmit={(values) => handleCreate(values, false)}
              onSubmitAndAddAnother={(values) => handleCreate(values, true)}
              onCancel={onClose}
            />
          )}
        </DialogContent>
      </Dialog>

      <DuplicateCardPurchaseDialog
        duplicate={pendingCreate?.duplicate ?? null}
        onReview={() => setPendingCreate(null)}
        onSaveAnyway={confirmPendingCreate}
      />
    </>
  )
}
