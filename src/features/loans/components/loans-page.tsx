import { useState } from "react"
import { useParams } from "react-router"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/features/auth/use-auth"
import { parseAmountInputValue } from "@/shared/lib/amount-input"
import {
  type DuplicateCandidate,
  findPossibleDuplicate,
} from "@/shared/lib/duplicate-expense"
import { formatArs, roundArs, sumArs } from "@/shared/lib/money"
import {
  formatPeriodLabel,
  getCurrentPeriod,
  parsePeriod,
  type Period,
} from "@/shared/lib/period"

import {
  CREATE_ERROR_MESSAGE,
  type CreateLoanInput,
  DELETE_ERROR_MESSAGE,
  SAVE_AMOUNTS_ERROR_MESSAGE,
  UPDATE_ERROR_MESSAGE,
  type UpdateLoanInput,
  useCreateLoanMutation,
  useDeleteLoanMutation,
  useSetLoanInstallmentAmountsMutation,
  useUpdateLoanMutation,
} from "../api/loan-mutations"
import {
  useLoansQuery,
  usePendingLoanInstallmentsQuery,
} from "../api/loan-queries"
import {
  toLoanCandidates,
  toLoanDraftCandidate,
} from "../model/loan-duplicates"
import {
  type LoanEditFormValues,
  type LoanFormValues,
  parsePositiveInteger,
} from "../model/loan-form"
import { countMissingInstallmentsUpTo } from "../model/loan-installment-amounts"
import {
  groupLoansByEntity,
  isLastInstallment,
  type LoanRow,
} from "../model/loan-rows"
import { DuplicateLoanDialog } from "./duplicate-loan-dialog"
import { LoanEditForm } from "./loan-edit-form"
import { LoanForm } from "./loan-form"
import { LoanInstallmentAmountsForm } from "./loan-installment-amounts-form"

const LOAD_ERROR_MESSAGE =
  "No pudimos cargar los préstamos del mes. Intentá de nuevo en un momento."

const EMPTY_MESSAGE = "Todavía no cargaste préstamos para este mes."

const MISSING_AMOUNT_LABEL = "Falta completar importe"

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

const buildCreateDefaults = (): LoanFormValues => ({
  concept: "",
  entity: "",
  quotaAmount: "",
  startingInstallment: "1",
  totalInstallments: "12",
})

const buildEditDefaults = (loan: EditableLoan): LoanEditFormValues => ({
  concept: loan.row.conceptText,
  entity: loan.row.entity,
  totalInstallments: String(loan.totalInstallments),
  editedInstallment: String(loan.installmentNumber),
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

const computeKnownTotal = (rows: readonly LoanRow[]) =>
  sumArs(
    rows
      .filter((row): row is LoanRow & { amount: number } => row.amount !== null)
      .map((row) => roundArs(row.amount))
  )

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; loan: EditableLoan }
  | { kind: "amounts"; row: LoanRow }

/** A loan waiting for the user to answer the duplicate warning (RF-09). */
type PendingLoan = {
  input: CreateLoanInput
  keepFormOpen: boolean
  duplicate: DuplicateCandidate
}

type DeleteLoanDialogProps = {
  concept: string
  isDeleting: boolean
  onConfirm: (closeDialog: () => void) => void
}

/**
 * Each row owns its confirmation state, so the dialog only closes once the
 * delete actually succeeded.
 */
const DeleteLoanDialog = ({
  concept,
  isDeleting,
  onConfirm,
}: DeleteLoanDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
      <AlertDialogTrigger
        render={<Button type="button" size="sm" variant="ghost" />}
      >
        Eliminar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este préstamo?</AlertDialogTitle>
          <AlertDialogDescription>
            Se van a borrar todas las cuotas de «{concept}», pasadas y futuras.
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={() => onConfirm(() => setIsOpen(false))}
          >
            Sí, eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const LoansPage = () => {
  const { year, month } = useParams()
  const period = parsePeriod(year, month) ?? getCurrentPeriod()

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const loansQuery = useLoansQuery(userId, period)
  const pendingInstallmentsQuery = usePendingLoanInstallmentsQuery(userId)
  const createLoan = useCreateLoanMutation(userId)
  const updateLoan = useUpdateLoanMutation(userId)
  const saveInstallmentAmounts = useSetLoanInstallmentAmountsMutation(userId)
  const deleteLoan = useDeleteLoanMutation(userId)

  const [editor, setEditor] = useState<EditorState>({ kind: "closed" })
  const [pendingCreate, setPendingCreate] = useState<PendingLoan | null>(null)
  // RF-09: remounting the create form is what resets it to its defaults, so
  // nothing (not even the installment number) survives the previous load.
  const [createFormKey, setCreateFormKey] = useState(0)

  const closeEditor = () => setEditor({ kind: "closed" })

  const saveCreate = (input: CreateLoanInput, keepFormOpen: boolean) => {
    createLoan.mutate(input, {
      onSuccess: () => {
        if (keepFormOpen) {
          setCreateFormKey((key) => key + 1)
          return
        }

        closeEditor()
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

  const handleUpdate = (values: LoanEditFormValues, loan: EditableLoan) => {
    const input = toUpdateInput(values, loan, period)

    if (input === null) {
      return
    }

    updateLoan.mutate(input, { onSuccess: closeEditor })
  }

  if (loansQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{LOAD_ERROR_MESSAGE}</AlertDescription>
      </Alert>
    )
  }

  if (userId === null || loansQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          {/* The skeleton mirrors the list, so keep a text equivalent for
              assistive technology and for tests. */}
          <p role="status" className="sr-only">
            Cargando los préstamos del mes…
          </p>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-7 w-64" />
        </CardContent>
      </Card>
    )
  }

  const rows = loansQuery.data ?? []
  const groups = groupLoansByEntity(rows)
  const periodLabel = formatPeriodLabel(period)
  const pendingInstallments = pendingInstallmentsQuery.data ?? []
  const missingUpToNow = countMissingInstallmentsUpTo(
    pendingInstallments,
    period
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Préstamos</h1>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        {editor.kind === "closed" ? (
          <Button type="button" onClick={() => setEditor({ kind: "create" })}>
            Agregar préstamo
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? null : (
        <Card size="sm">
          <CardContent className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">
              Cuotas conocidas del mes
            </p>
            <p className="font-mono text-xl font-semibold tracking-tight text-foreground">
              {formatArs(computeKnownTotal(rows))}
            </p>
            {missingUpToNow === 0 ? null : (
              <p className="text-sm text-foreground">
                Subtotal incompleto: hay {missingUpToNow}{" "}
                {missingUpToNow === 1 ? "cuota" : "cuotas"} sin importe en este
                mes o en meses anteriores.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {editor.kind === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo préstamo</CardTitle>
          </CardHeader>
          <CardContent>
            <LoanForm
              key={createFormKey}
              defaultValues={buildCreateDefaults()}
              period={period}
              isSaving={createLoan.isLoading}
              errorMessage={createLoan.isError ? CREATE_ERROR_MESSAGE : null}
              onSubmit={(values) => handleCreate(values, false)}
              onSubmitAndAddAnother={(values) => handleCreate(values, true)}
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      <DuplicateLoanDialog
        duplicate={pendingCreate?.duplicate ?? null}
        onReview={() => setPendingCreate(null)}
        onSaveAnyway={confirmPendingCreate}
      />

      {editor.kind === "edit" ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar «{editor.loan.row.conceptText}»</CardTitle>
          </CardHeader>
          <CardContent>
            <LoanEditForm
              defaultValues={buildEditDefaults(editor.loan)}
              editedPeriod={period}
              isSaving={updateLoan.isLoading}
              errorMessage={updateLoan.isError ? UPDATE_ERROR_MESSAGE : null}
              onSubmit={(values) => handleUpdate(values, editor.loan)}
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {editor.kind === "amounts" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Completar próximas cuotas de «{editor.row.conceptText}»
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LoanInstallmentAmountsForm
              concept={editor.row.conceptText}
              installments={pendingInstallments.filter(
                (installment) => installment.planId === editor.row.planId
              )}
              isSaving={saveInstallmentAmounts.isLoading}
              errorMessage={
                saveInstallmentAmounts.isError
                  ? SAVE_AMOUNTS_ERROR_MESSAGE
                  : null
              }
              onSubmit={(amounts) =>
                saveInstallmentAmounts.mutate(amounts, {
                  onSuccess: closeEditor,
                })
              }
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {deleteLoan.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{DELETE_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}

      {groups.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-base text-foreground">{EMPTY_MESSAGE}</p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.entity} className="py-0">
            <CardHeader className="pt-4">
              <CardTitle>{group.entity}</CardTitle>
            </CardHeader>

            <Table className="min-w-[640px] text-sm">
              <TableCaption className="sr-only">
                Préstamos de {group.entity} en {periodLabel}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="px-4 text-muted-foreground">
                    Concepto
                  </TableHead>
                  <TableHead scope="col" className="px-4 text-muted-foreground">
                    Cuota
                  </TableHead>
                  <TableHead
                    scope="col"
                    className="px-4 text-right text-muted-foreground"
                  >
                    Importe de la cuota
                  </TableHead>
                  <TableHead
                    scope="col"
                    className="px-4 text-right text-muted-foreground"
                  >
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((row) => {
                  const editable = toEditableLoan(row)

                  return (
                    <TableRow key={row.occurrenceId}>
                      <TableCell className="px-4">{row.conceptText}</TableCell>
                      <TableCell className="px-4">
                        {row.installmentNumber === null ||
                        row.totalInstallments === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="font-mono">
                              {row.installmentNumber}/{row.totalInstallments}
                            </Badge>
                            {isLastInstallment(row) ? (
                              <Badge variant="secondary">Última cuota</Badge>
                            ) : null}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 text-right font-mono">
                        {row.amount === null ? (
                          <span className="font-sans text-muted-foreground">
                            {MISSING_AMOUNT_LABEL}
                          </span>
                        ) : (
                          formatArs(row.amount)
                        )}
                      </TableCell>
                      <TableCell className="px-4">
                        <span className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditor({ kind: "amounts", row })}
                          >
                            Completar próximas cuotas
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={editable === null}
                            onClick={() => {
                              if (editable !== null) {
                                setEditor({ kind: "edit", loan: editable })
                              }
                            }}
                          >
                            Editar
                          </Button>
                          <DeleteLoanDialog
                            concept={row.conceptText}
                            isDeleting={deleteLoan.isLoading}
                            onConfirm={(closeDialog) => {
                              deleteLoan.mutate(row.planId, {
                                onSuccess: closeDialog,
                              })
                            }}
                          />
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  )
}
