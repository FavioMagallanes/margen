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
import { useMonthlyBudgetQuery } from "@/features/monthly-budget/api/monthly-budget-queries"
import { toArsEquivalent } from "@/features/monthly-budget/model/expense-total"
import { parseAmountInputValue } from "@/shared/lib/amount-input"
import {
  type DuplicateCandidate,
  findPossibleDuplicate,
} from "@/shared/lib/duplicate-expense"
import { formatArs } from "@/shared/lib/money"
import {
  formatPeriodLabel,
  getCurrentPeriod,
  parsePeriod,
  type Period,
} from "@/shared/lib/period"

import {
  CREATE_ERROR_MESSAGE,
  type CreateCardPurchaseInput,
  DELETE_ERROR_MESSAGE,
  UPDATE_ERROR_MESSAGE,
  type UpdateCardPurchaseInput,
  useCreateCardPurchaseMutation,
  useDeleteCardPurchaseMutation,
  useUpdateCardPurchaseMutation,
} from "../api/card-purchase-mutations"
import { useCardPurchasesQuery } from "../api/card-purchase-queries"
import {
  toCardPurchaseCandidates,
  toCardPurchaseDraftCandidate,
} from "../model/card-purchase-duplicates"
import {
  CARD_OPTIONS,
  type CardOption,
  type CardPurchaseFormValues,
  formatQuotaAmountInput,
  parsePositiveInteger,
} from "../model/card-purchase-form"
import {
  type CardPurchaseRow,
  groupPurchasesByCard,
  isLastInstallment,
} from "../model/card-purchase-groups"
import { CardPurchaseForm } from "./card-purchase-form"
import { DuplicateCardPurchaseDialog } from "./duplicate-card-purchase-dialog"

const LOAD_ERROR_MESSAGE =
  "No pudimos cargar las compras con tarjeta del mes. Intentá de nuevo en un momento."

const EMPTY_MESSAGE = "Todavía no cargaste compras con tarjeta para este mes."

const MISSING_AMOUNT_LABEL = "Sin dato"

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const formatOriginalAmount = (row: CardPurchaseRow): string => {
  if (row.amount === null || row.currency === null) {
    return MISSING_AMOUNT_LABEL
  }

  return row.currency === "usd"
    ? usdFormatter.format(row.amount)
    : formatArs(row.amount)
}

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

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; purchase: EditableCardPurchase }

/** A purchase waiting for the user to answer the duplicate warning (RF-09). */
type PendingCardPurchase = {
  input: CreateCardPurchaseInput
  keepFormOpen: boolean
  duplicate: DuplicateCandidate
}

type DeleteCardPurchaseDialogProps = {
  concept: string
  isDeleting: boolean
  onConfirm: (closeDialog: () => void) => void
}

/**
 * Each row owns its confirmation state, so the dialog only closes once the
 * delete actually succeeded.
 */
const DeleteCardPurchaseDialog = ({
  concept,
  isDeleting,
  onConfirm,
}: DeleteCardPurchaseDialogProps) => {
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
          <AlertDialogTitle>¿Eliminar esta compra?</AlertDialogTitle>
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

export const CardPurchasesPage = () => {
  const { year, month } = useParams()
  const period = parsePeriod(year, month) ?? getCurrentPeriod()

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const purchasesQuery = useCardPurchasesQuery(userId, period)
  // RF-06: the ARS equivalent needs the rate stored for the viewed month; the
  // monthly budget query is already the canonical way to read it.
  const budgetQuery = useMonthlyBudgetQuery(userId, period)
  const arsPerUsd = budgetQuery.data?.exchangeRateValue ?? null
  const createPurchase = useCreateCardPurchaseMutation(userId)
  const updatePurchase = useUpdateCardPurchaseMutation(userId)
  const deletePurchase = useDeleteCardPurchaseMutation(userId)

  const [editor, setEditor] = useState<EditorState>({ kind: "closed" })
  const [pendingCreate, setPendingCreate] =
    useState<PendingCardPurchase | null>(null)
  // RF-09: remounting the create form is what resets it to its defaults, so
  // nothing (not even the installment number) survives the previous load.
  const [createFormKey, setCreateFormKey] = useState(0)

  const closeEditor = () => setEditor({ kind: "closed" })

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

        closeEditor()
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

  const handleUpdate = (
    values: CardPurchaseFormValues,
    purchase: EditableCardPurchase
  ) => {
    const input = toUpdateInput(values, purchase, period)

    if (input === null) {
      return
    }

    updatePurchase.mutate(input, { onSuccess: closeEditor })
  }

  if (purchasesQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{LOAD_ERROR_MESSAGE}</AlertDescription>
      </Alert>
    )
  }

  if (userId === null || purchasesQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          {/* The skeleton mirrors the list, so keep a text equivalent for
              assistive technology and for tests. */}
          <p role="status" className="sr-only">
            Cargando las compras del mes…
          </p>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-7 w-64" />
        </CardContent>
      </Card>
    )
  }

  const rows = purchasesQuery.data ?? []
  const groups = groupPurchasesByCard(rows)
  const periodLabel = formatPeriodLabel(period)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Compras con tarjeta
          </h1>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        {editor.kind === "closed" ? (
          <Button type="button" onClick={() => setEditor({ kind: "create" })}>
            Agregar compra
          </Button>
        ) : null}
      </div>

      {editor.kind === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle>Nueva compra</CardTitle>
          </CardHeader>
          <CardContent>
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
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      <DuplicateCardPurchaseDialog
        duplicate={pendingCreate?.duplicate ?? null}
        onReview={() => setPendingCreate(null)}
        onSaveAnyway={confirmPendingCreate}
      />

      {editor.kind === "edit" ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar «{editor.purchase.row.conceptText}»</CardTitle>
          </CardHeader>
          <CardContent>
            <CardPurchaseForm
              mode="edit"
              editedPeriod={period}
              defaultValues={buildEditDefaults(editor.purchase, period)}
              isSaving={updatePurchase.isLoading}
              errorMessage={
                updatePurchase.isError ? UPDATE_ERROR_MESSAGE : null
              }
              onSubmit={(values) => handleUpdate(values, editor.purchase)}
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {deletePurchase.isError ? (
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
          <Card key={group.card} className="py-0">
            <CardHeader className="pt-4">
              <CardTitle>{group.card}</CardTitle>
            </CardHeader>

            <Table className="min-w-[640px] text-sm">
              <TableCaption className="sr-only">
                Compras de {group.card} en {periodLabel}
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
                    Equivalente en ARS
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
                  const editable = toEditableCardPurchase(row)
                  const arsEquivalent = toArsEquivalent(
                    { amount: row.amount, currency: row.currency },
                    arsPerUsd
                  )

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
                        {formatOriginalAmount(row)}
                      </TableCell>
                      <TableCell className="px-4 text-right font-mono">
                        {arsEquivalent === null
                          ? MISSING_AMOUNT_LABEL
                          : formatArs(arsEquivalent)}
                      </TableCell>
                      <TableCell className="px-4">
                        <span className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={editable === null}
                            onClick={() => {
                              if (editable !== null) {
                                setEditor({
                                  kind: "edit",
                                  purchase: editable,
                                })
                              }
                            }}
                          >
                            Editar
                          </Button>
                          <DeleteCardPurchaseDialog
                            concept={row.conceptText}
                            isDeleting={deletePurchase.isLoading}
                            onConfirm={(closeDialog) => {
                              deletePurchase.mutate(row.planId, {
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
