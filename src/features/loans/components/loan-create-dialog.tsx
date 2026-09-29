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
  type CreateLoanInput,
  useCreateLoanMutation,
} from "../api/loan-mutations"
import { useLoansQuery } from "../api/loan-queries"
import {
  toLoanCandidates,
  toLoanDraftCandidate,
} from "../model/loan-duplicates"
import { type LoanFormValues, parsePositiveInteger } from "../model/loan-form"
import { DuplicateLoanDialog } from "./duplicate-loan-dialog"
import { LoanForm } from "./loan-form"

type LoanCreateDialogProps = {
  /** RF-03: a loan is always registered in the month on screen. */
  period: Period
  onClose: () => void
}

const LOADING_MESSAGE = "Cargando los préstamos del mes…"

/** A loan waiting for the user to answer the duplicate warning (RF-09). */
type PendingLoan = {
  input: CreateLoanInput
  keepFormOpen: boolean
  duplicate: DuplicateCandidate
}

const buildCreateDefaults = (): LoanFormValues => ({
  concept: "",
  entity: "",
  quotaAmount: "",
  startingInstallment: "1",
  totalInstallments: "12",
})

const toCreateInput = (
  values: LoanFormValues,
  period: Period
): CreateLoanInput | null => {
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
    entity: values.entity,
    quotaAmount: quotaAmount.toNumber(),
    startingInstallment,
    totalInstallments,
    period,
  }
}

/**
 * RF-03 / RF-09: loading a loan from the budget month, with the same form,
 * validation and duplicate warning the feature already owned.
 */
export const LoanCreateDialog = ({
  period,
  onClose,
}: LoanCreateDialogProps) => {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const loansQuery = useLoansQuery(userId, period)
  const createLoan = useCreateLoanMutation(userId)

  const [pendingCreate, setPendingCreate] = useState<PendingLoan | null>(null)
  // RF-09: remounting the create form is what resets it to its defaults, so
  // nothing (not even the installment number) survives the previous load.
  const [createFormKey, setCreateFormKey] = useState(0)

  const saveCreate = (input: CreateLoanInput, keepFormOpen: boolean) => {
    createLoan.mutate(input, {
      onSuccess: () => {
        if (keepFormOpen) {
          setCreateFormKey((key) => key + 1)
          return
        }

        onClose()
      },
    })
  }

  const handleCreate = (values: LoanFormValues, keepFormOpen: boolean) => {
    const input = toCreateInput(values, period)

    if (input === null) {
      return
    }

    const duplicate = findPossibleDuplicate(
      toLoanDraftCandidate(input),
      toLoanCandidates(loansQuery.data ?? [])
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
            <DialogTitle>Nuevo préstamo</DialogTitle>
            <DialogDescription>
              Las cuotas arrancan en {formatPeriodLabel(period)}.
            </DialogDescription>
          </DialogHeader>

          {loansQuery.isLoading ? (
            // RF-09: the duplicate warning compares against the loans already
            // loaded in the month, so the form only opens once they are known.
            <p role="status">{LOADING_MESSAGE}</p>
          ) : (
            <LoanForm
              key={createFormKey}
              defaultValues={buildCreateDefaults()}
              period={period}
              isSaving={createLoan.isLoading}
              errorMessage={createLoan.isError ? CREATE_ERROR_MESSAGE : null}
              onSubmit={(values) => handleCreate(values, false)}
              onSubmitAndAddAnother={(values) => handleCreate(values, true)}
              onCancel={onClose}
            />
          )}
        </DialogContent>
      </Dialog>

      <DuplicateLoanDialog
        duplicate={pendingCreate?.duplicate ?? null}
        onReview={() => setPendingCreate(null)}
        onSaveAnyway={confirmPendingCreate}
      />
    </>
  )
}
