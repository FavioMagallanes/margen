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
import { formatArs } from "@/shared/lib/money"
import {
  formatPeriodLabel,
  getCurrentPeriod,
  parsePeriod,
} from "@/shared/lib/period"

import {
  CREATE_ERROR_MESSAGE,
  DELETE_ERROR_MESSAGE,
  type OtherExpenseValues,
  UPDATE_ERROR_MESSAGE,
  useCreateOtherExpenseMutation,
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
  toStoredPaymentMethod,
} from "../model/other-expense-form"
import { OtherExpenseForm } from "./other-expense-form"

const LOAD_ERROR_MESSAGE =
  "No pudimos cargar los gastos del mes. Intentá de nuevo en un momento."

const EMPTY_MESSAGE = "Todavía no cargaste otros gastos para este mes."

const UNKNOWN_CURRENCY_LABEL = "Sin dato"

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const CURRENCY_LABELS = {
  ars: "ARS",
  usd: "USD",
} as const

const formatRowAmount = (row: OtherExpenseRow): string => {
  if (row.currency === "usd") {
    return usdFormatter.format(row.amount)
  }

  if (row.currency === "ars") {
    return formatArs(row.amount)
  }

  return UNKNOWN_CURRENCY_LABEL
}

const buildCreateDefaults = (): OtherExpenseFormValues => ({
  concept: "",
  amount: "",
  currency: "ars",
  paymentMethod: "none",
  paymentMethodText: "",
})

const buildEditDefaults = (row: OtherExpenseRow): OtherExpenseFormValues => ({
  concept: row.concept,
  amount: formatOtherExpenseAmountInput(row.amount),
  // An unsupported stored currency falls back to the proposed one (RF-04).
  currency: row.currency ?? "ars",
  ...fromStoredPaymentMethod(row.paymentMethod),
})

const toExpenseValues = (
  values: OtherExpenseFormValues
): OtherExpenseValues | null => {
  const amount = parseAmountInputValue(values.amount)

  // The resolver already rejected this case; this only narrows the type.
  if (amount === null) {
    return null
  }

  return {
    concept: values.concept,
    amount: amount.toNumber(),
    currency: values.currency,
    paymentMethod: toStoredPaymentMethod(values),
  }
}

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: OtherExpenseRow }

type DeleteOtherExpenseDialogProps = {
  concept: string
  isDeleting: boolean
  onConfirm: (closeDialog: () => void) => void
}

/**
 * Each row owns its confirmation state, so the dialog only closes once the
 * delete actually succeeded.
 */
const DeleteOtherExpenseDialog = ({
  concept,
  isDeleting,
  onConfirm,
}: DeleteOtherExpenseDialogProps) => {
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
          <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
          <AlertDialogDescription>
            Se va a borrar «{concept}» de este mes. Esta acción no se puede
            deshacer.
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

export const OtherExpensesPage = () => {
  const { year, month } = useParams()
  const period = parsePeriod(year, month) ?? getCurrentPeriod()

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const otherExpensesQuery = useOtherExpensesQuery(userId, period)
  const conceptsQuery = useOtherExpenseConceptsQuery(userId)
  const createOtherExpense = useCreateOtherExpenseMutation(userId)
  const updateOtherExpense = useUpdateOtherExpenseMutation(userId)
  const deleteOtherExpense = useDeleteOtherExpenseMutation(userId)

  const [editor, setEditor] = useState<EditorState>({ kind: "closed" })

  const closeEditor = () => setEditor({ kind: "closed" })

  const handleCreate = (values: OtherExpenseFormValues) => {
    const expenseValues = toExpenseValues(values)

    if (expenseValues === null) {
      return
    }

    createOtherExpense.mutate(
      { ...expenseValues, period },
      { onSuccess: closeEditor }
    )
  }

  const handleUpdate = (
    values: OtherExpenseFormValues,
    row: OtherExpenseRow
  ) => {
    const expenseValues = toExpenseValues(values)

    if (expenseValues === null) {
      return
    }

    updateOtherExpense.mutate(
      { ...expenseValues, id: row.id },
      { onSuccess: closeEditor }
    )
  }

  if (otherExpensesQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{LOAD_ERROR_MESSAGE}</AlertDescription>
      </Alert>
    )
  }

  if (userId === null || otherExpensesQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          {/* The skeleton mirrors the list, so keep a text equivalent for
              assistive technology and for tests. */}
          <p role="status" className="sr-only">
            Cargando los gastos del mes…
          </p>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-7 w-64" />
        </CardContent>
      </Card>
    )
  }

  const rows = otherExpensesQuery.data ?? []
  const periodLabel = formatPeriodLabel(period)
  const conceptSuggestions = conceptsQuery.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Otros gastos</h1>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        {editor.kind === "closed" ? (
          <Button type="button" onClick={() => setEditor({ kind: "create" })}>
            Agregar gasto
          </Button>
        ) : null}
      </div>

      {editor.kind === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <OtherExpenseForm
              mode="create"
              defaultValues={buildCreateDefaults()}
              conceptSuggestions={conceptSuggestions}
              period={period}
              isSaving={createOtherExpense.isLoading}
              errorMessage={
                createOtherExpense.isError ? CREATE_ERROR_MESSAGE : null
              }
              onSubmit={handleCreate}
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {editor.kind === "edit" ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar «{editor.row.concept}»</CardTitle>
          </CardHeader>
          <CardContent>
            <OtherExpenseForm
              mode="edit"
              defaultValues={buildEditDefaults(editor.row)}
              conceptSuggestions={conceptSuggestions}
              period={period}
              isSaving={updateOtherExpense.isLoading}
              errorMessage={
                updateOtherExpense.isError ? UPDATE_ERROR_MESSAGE : null
              }
              onSubmit={(values) => handleUpdate(values, editor.row)}
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {deleteOtherExpense.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{DELETE_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-base text-foreground">{EMPTY_MESSAGE}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table className="min-w-[640px] text-sm">
            <TableCaption className="sr-only">
              Otros gastos de {periodLabel}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="px-4 text-muted-foreground">
                  Concepto
                </TableHead>
                <TableHead scope="col" className="px-4 text-muted-foreground">
                  Medio de pago
                </TableHead>
                <TableHead scope="col" className="px-4 text-muted-foreground">
                  Moneda
                </TableHead>
                <TableHead
                  scope="col"
                  className="px-4 text-right text-muted-foreground"
                >
                  Importe
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
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4">{row.concept}</TableCell>
                  <TableCell className="px-4">
                    {row.paymentMethod === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge variant="secondary">{row.paymentMethod}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    {row.currency === null ? (
                      <span className="text-muted-foreground">
                        {UNKNOWN_CURRENCY_LABEL}
                      </span>
                    ) : (
                      <Badge variant="outline" className="font-mono">
                        {CURRENCY_LABELS[row.currency]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono">
                    {formatRowAmount(row)}
                  </TableCell>
                  <TableCell className="px-4">
                    <span className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditor({ kind: "edit", row })}
                      >
                        Editar
                      </Button>
                      <DeleteOtherExpenseDialog
                        concept={row.concept}
                        isDeleting={deleteOtherExpense.isLoading}
                        onConfirm={(closeDialog) => {
                          deleteOtherExpense.mutate(row.id, {
                            onSuccess: closeDialog,
                          })
                        }}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
