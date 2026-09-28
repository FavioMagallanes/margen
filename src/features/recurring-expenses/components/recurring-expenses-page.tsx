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
import { formatArs } from "@/shared/lib/money"
import {
  formatPeriodLabel,
  getCurrentPeriod,
  parsePeriod,
} from "@/shared/lib/period"

import {
  CREATE_ERROR_MESSAGE,
  DELETE_ERROR_MESSAGE,
  GENERATE_ERROR_MESSAGE,
  SET_AMOUNT_ERROR_MESSAGE,
  STOP_ERROR_MESSAGE,
  UPDATE_ERROR_MESSAGE,
  useCreateRecurringMutation,
  useDeleteRecurringMutation,
  useGenerateRecurringOccurrencesMutation,
  useSetRecurringAmountMutation,
  useStopRecurringMutation,
  useUpdateRecurringMutation,
} from "../api/recurring-expense-mutations"
import {
  useRecurringOccurrencesQuery,
  useRecurringPlansQuery,
} from "../api/recurring-expense-queries"
import {
  formatRecurringAmountInput,
  isRecurringCurrency,
  isRecurringGroup,
  type RecurringCurrency,
  type RecurringEditFormValues,
  type RecurringFormValues,
  type RecurringGroup,
  toCreateRecurringPlanInput,
  toRecurringPlanInput,
} from "../model/recurring-expense-form"
import {
  isStoppedAt,
  type RecurringRow,
  toPendingRecurringPlans,
} from "../model/recurring-plans"
import { RecurringAmountForm } from "./recurring-amount-form"
import { RecurringExpenseEditForm } from "./recurring-expense-edit-form"
import { RecurringExpenseForm } from "./recurring-expense-form"
import { RecurringGenerationForm } from "./recurring-generation-form"

const LOAD_ERROR_MESSAGE =
  "No pudimos cargar los recurrentes del mes. Intentá de nuevo en un momento."

const EMPTY_MESSAGE = "Todavía no generaste recurrentes para este mes."

const SKIPPED_LABEL = "Omitido este mes"

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const formatRowAmount = (row: RecurringRow): string => {
  if (row.amount === null) {
    return "Sin dato"
  }

  return row.currency === "usd"
    ? usdFormatter.format(row.amount)
    : formatArs(row.amount)
}

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

const buildCreateDefaults = (): RecurringFormValues => ({
  concept: "",
  groupLabel: "Otros gastos",
  currency: "ars",
  amountMode: "fixed",
  startingAmount: "",
  duration: "untilStopped",
  totalMonths: "12",
})

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

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "generate" }
  | { kind: "edit"; recurring: EditableRecurring }
  | { kind: "amount"; row: RecurringRow }

type ConfirmDialogProps = {
  trigger: string
  title: string
  description: string
  confirmLabel: string
  isDestructive: boolean
  isRunning: boolean
  isDisabled: boolean
  onConfirm: (closeDialog: () => void) => void
}

/**
 * Each row owns its confirmation state, so the dialog only closes once the
 * action actually succeeded.
 */
const ConfirmDialog = ({
  trigger,
  title,
  description,
  confirmLabel,
  isDestructive,
  isRunning,
  isDisabled,
  onConfirm,
}: ConfirmDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant={isDestructive ? "ghost" : "outline"}
            disabled={isDisabled}
          />
        }
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={isDestructive ? "destructive" : "default"}
            disabled={isRunning}
            onClick={() => onConfirm(() => setIsOpen(false))}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const RecurringExpensesPage = () => {
  const { year, month } = useParams()
  const period = parsePeriod(year, month) ?? getCurrentPeriod()

  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const occurrencesQuery = useRecurringOccurrencesQuery(userId, period)
  const plansQuery = useRecurringPlansQuery(userId)
  const createRecurring = useCreateRecurringMutation(userId)
  const updateRecurring = useUpdateRecurringMutation(userId)
  const generateOccurrences = useGenerateRecurringOccurrencesMutation(userId)
  const setOccurrenceAmount = useSetRecurringAmountMutation(userId)
  const stopRecurring = useStopRecurringMutation(userId)
  const deleteRecurring = useDeleteRecurringMutation(userId)

  const [editor, setEditor] = useState<EditorState>({ kind: "closed" })

  const closeEditor = () => setEditor({ kind: "closed" })

  const handleCreate = (values: RecurringFormValues) => {
    const input = toCreateRecurringPlanInput(values)

    if (input === null) {
      return
    }

    createRecurring.mutate({ ...input, period }, { onSuccess: closeEditor })
  }

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
      { onSuccess: closeEditor }
    )
  }

  if (occurrencesQuery.isError || plansQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{LOAD_ERROR_MESSAGE}</AlertDescription>
      </Alert>
    )
  }

  if (userId === null || occurrencesQuery.isLoading || plansQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          {/* The skeleton mirrors the list, so keep a text equivalent for
              assistive technology and for tests. */}
          <p role="status" className="sr-only">
            Cargando los recurrentes del mes…
          </p>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-7 w-64" />
        </CardContent>
      </Card>
    )
  }

  const rows = occurrencesQuery.data ?? []
  const periodLabel = formatPeriodLabel(period)
  // A pure read: which plans the explicit generation would offer for this
  // month. Opening the page never writes any of them (AGENTS.md).
  const pendingPlans = toPendingRecurringPlans(plansQuery.data ?? [], period)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Recurrentes</h1>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        {editor.kind === "closed" ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pendingPlans.length === 0}
              onClick={() => setEditor({ kind: "generate" })}
            >
              Generar recurrentes de este mes
            </Button>
            <Button type="button" onClick={() => setEditor({ kind: "create" })}>
              Agregar recurrente
            </Button>
          </div>
        ) : null}
      </div>

      {editor.kind === "closed" && pendingPlans.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay recurrentes activos pendientes de generar en {periodLabel}.
        </p>
      ) : null}

      {editor.kind === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo recurrente</CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringExpenseForm
              defaultValues={buildCreateDefaults()}
              period={period}
              isSaving={createRecurring.isLoading}
              errorMessage={
                createRecurring.isError ? CREATE_ERROR_MESSAGE : null
              }
              onSubmit={handleCreate}
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {editor.kind === "generate" ? (
        <Card>
          <CardHeader>
            <CardTitle>Generar recurrentes de {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringGenerationForm
              plans={pendingPlans}
              period={period}
              isSaving={generateOccurrences.isLoading}
              errorMessage={
                generateOccurrences.isError ? GENERATE_ERROR_MESSAGE : null
              }
              onSubmit={(items) =>
                generateOccurrences.mutate(
                  { period, items },
                  { onSuccess: closeEditor }
                )
              }
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {editor.kind === "edit" ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar «{editor.recurring.row.concept}»</CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringExpenseEditForm
              defaultValues={buildEditDefaults(editor.recurring)}
              editedPeriod={period}
              isSaving={updateRecurring.isLoading}
              errorMessage={
                updateRecurring.isError ? UPDATE_ERROR_MESSAGE : null
              }
              onSubmit={(values) => handleUpdate(values, editor.recurring)}
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {editor.kind === "amount" ? (
        <Card>
          <CardHeader>
            <CardTitle>Corregir el importe de «{editor.row.concept}»</CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringAmountForm
              concept={editor.row.concept}
              period={period}
              defaultAmount={
                editor.row.amount === null
                  ? ""
                  : formatRecurringAmountInput(editor.row.amount)
              }
              defaultIsEstimated={editor.row.amountIsEstimated}
              isSaving={setOccurrenceAmount.isLoading}
              errorMessage={
                setOccurrenceAmount.isError ? SET_AMOUNT_ERROR_MESSAGE : null
              }
              onSubmit={(amount, isEstimated) =>
                setOccurrenceAmount.mutate(
                  {
                    occurrenceId: editor.row.occurrenceId,
                    amount,
                    isEstimated,
                  },
                  { onSuccess: closeEditor }
                )
              }
              onCancel={closeEditor}
            />
          </CardContent>
        </Card>
      ) : null}

      {stopRecurring.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{STOP_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}

      {deleteRecurring.isError ? (
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
          <Table className="min-w-[720px] text-sm">
            <TableCaption className="sr-only">
              Recurrentes de {periodLabel}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="px-4 text-muted-foreground">
                  Concepto
                </TableHead>
                <TableHead scope="col" className="px-4 text-muted-foreground">
                  Agrupación
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
              {rows.map((row) => {
                const editable = toEditableRecurring(row)
                const isStopped = isStoppedAt(row.stoppedFrom, period)

                return (
                  <TableRow key={row.occurrenceId}>
                    <TableCell className="px-4">
                      <span className="flex items-center gap-2">
                        {row.concept}
                        {isStopped ? (
                          <Badge variant="outline">Detenido</Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="px-4">{row.groupLabel}</TableCell>
                    <TableCell className="px-4 text-right font-mono">
                      {row.isSkipped ? (
                        <Badge variant="secondary" className="font-sans">
                          {SKIPPED_LABEL}
                        </Badge>
                      ) : (
                        <span className="flex items-center justify-end gap-2">
                          {row.amountIsEstimated ? (
                            <Badge variant="secondary" className="font-sans">
                              Estimado
                            </Badge>
                          ) : null}
                          {formatRowAmount(row)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4">
                      <span className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          // A skipped month is not a row waiting for an amount.
                          disabled={row.isSkipped}
                          onClick={() => setEditor({ kind: "amount", row })}
                        >
                          Corregir importe
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={editable === null}
                          onClick={() => {
                            if (editable !== null) {
                              setEditor({ kind: "edit", recurring: editable })
                            }
                          }}
                        >
                          Editar
                        </Button>
                        <ConfirmDialog
                          trigger="Detener"
                          title="¿Detener este recurrente?"
                          description={`«${row.concept}» deja de ofrecerse desde ${periodLabel} en adelante. Los meses que ya generaste se mantienen como están.`}
                          confirmLabel="Sí, detener"
                          isDestructive={false}
                          isRunning={stopRecurring.isLoading}
                          isDisabled={isStopped}
                          onConfirm={(closeDialog) =>
                            stopRecurring.mutate(
                              { planId: row.planId, fromPeriod: period },
                              { onSuccess: closeDialog }
                            )
                          }
                        />
                        <ConfirmDialog
                          trigger="Eliminar"
                          title="¿Eliminar este recurrente?"
                          description={`Se van a borrar todos los meses de «${row.concept}», pasados y futuros. Esta acción no se puede deshacer.`}
                          confirmLabel="Sí, eliminar"
                          isDestructive
                          isRunning={deleteRecurring.isLoading}
                          isDisabled={false}
                          onConfirm={(closeDialog) =>
                            deleteRecurring.mutate(row.planId, {
                              onSuccess: closeDialog,
                            })
                          }
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
