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
import {
  formatPeriodLabel,
  getCurrentPeriod,
  type Period,
} from "@/shared/lib/period"

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
  /** The month being viewed in the budget, which the form defaults to. */
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

const buildCreateDefaults = (period: Period): CardPurchaseFormValues => {
  const currentPeriod = getCurrentPeriod()
  // RF-02: the form only offers the current real month onwards, so the viewed
  // month is only a valid default while it belongs to that range.
  const isViewedMonthAvailable =
    period.year === currentPeriod.year && period.month >= currentPeriod.month

  return {
    concept: "",
    card: "BBVA",
    currency: "ars",
    quotaAmount: "",
    isSinglePayment: false,
    startingInstallment: "1",
    totalInstallments: "1",
    month: String(isViewedMonthAvailable ? period.month : currentPeriod.month),
  }
}

const toCreateInput = (
  values: CardPurchaseFormValues
): CreateCardPurchaseInput | null => {
  const quotaAmount = parseAmountInputValue(values.quotaAmount)
  const startingInstallment = parsePositiveInteger(values.startingInstallment)
  const totalInstallments = parsePositiveInteger(values.totalInstallments)
  const month = parsePositiveInteger(values.month)

  // The resolver already rejected these cases; this only narrows the types.
  if (
    quotaAmount === null ||
    startingInstallment === null ||
    totalInstallments === null ||
    month === null
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
    // RF-02: the year is never chosen in the form, it is always the current one.
    period: { year: getCurrentPeriod().year, month },
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
    const input = toCreateInput(values)

    if (input === null) {
      return
    }

    // The warning compares against the month already on screen, so it only
    // applies when the purchase is imputed to that same month.
    const isViewedMonth =
      input.period.year === period.year && input.period.month === period.month

    const duplicate = isViewedMonth
      ? findPossibleDuplicate(
          toCardPurchaseDraftCandidate(input),
          toCardPurchaseCandidates(purchasesQuery.data ?? [])
        )
      : null

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
              defaultValues={buildCreateDefaults(period)}
              isSaving={createPurchase.isLoading}
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
