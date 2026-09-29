import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CardPurchaseBatchDialog } from "@/features/card-purchases/components/card-purchase-batch-dialog"
import { CardPurchaseCreateDialog } from "@/features/card-purchases/components/card-purchase-create-dialog"
import { LoanCreateDialog } from "@/features/loans/components/loan-create-dialog"
import { OtherExpenseCreateDialog } from "@/features/other-expenses/components/other-expense-create-dialog"
import { RecurringCreateDialog } from "@/features/recurring-expenses/components/recurring-create-dialog"
import { RecurringGenerationDialog } from "@/features/recurring-expenses/components/recurring-generation-dialog"
import type { Period } from "@/shared/lib/period"

type AddExpenseMenuProps = {
  period: Period
}

/**
 * Which flow the user picked. The batch load and the recurring generation are
 * not "one more row": they are their own flows, so they are offered here as
 * separate entries instead of being hidden behind a type of expense.
 */
type ExpenseEntry =
  | "card_purchase"
  | "card_purchase_batch"
  | "loan"
  | "recurring"
  | "recurring_generation"
  | "other"

type EntryOption = {
  entry: ExpenseEntry
  label: string
}

const ENTRY_OPTIONS: EntryOption[] = [
  { entry: "card_purchase", label: "Compra con tarjeta" },
  { entry: "card_purchase_batch", label: "Cargar varias compras" },
  { entry: "loan", label: "Préstamo" },
  { entry: "recurring", label: "Gasto recurrente" },
  {
    entry: "recurring_generation",
    label: "Generar recurrentes de este mes",
  },
  { entry: "other", label: "Otro gasto" },
]

/**
 * The single entry point to load anything into the month: the type of expense
 * is chosen here, and the form that opens is the one its own feature already
 * owned.
 */
export const AddExpenseMenu = ({ period }: AddExpenseMenuProps) => {
  const [isChoosing, setIsChoosing] = useState(false)
  const [entry, setEntry] = useState<ExpenseEntry | null>(null)

  const closeEntry = () => setEntry(null)

  return (
    <>
      <Button type="button" onClick={() => setIsChoosing(true)}>
        Agregar gasto
      </Button>

      <Dialog open={isChoosing} onOpenChange={(open) => setIsChoosing(open)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>¿Qué querés agregar?</DialogTitle>
            <DialogDescription>
              Cada tipo de gasto abre su propio formulario.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {ENTRY_OPTIONS.map((option) => (
              <Button
                key={option.entry}
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setIsChoosing(false)
                  setEntry(option.entry)
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {entry === "card_purchase" ? (
        <CardPurchaseCreateDialog period={period} onClose={closeEntry} />
      ) : null}

      {entry === "card_purchase_batch" ? (
        <CardPurchaseBatchDialog period={period} onClose={closeEntry} />
      ) : null}

      {entry === "loan" ? (
        <LoanCreateDialog period={period} onClose={closeEntry} />
      ) : null}

      {entry === "recurring" ? (
        <RecurringCreateDialog period={period} onClose={closeEntry} />
      ) : null}

      {entry === "recurring_generation" ? (
        <RecurringGenerationDialog period={period} onClose={closeEntry} />
      ) : null}

      {entry === "other" ? (
        <OtherExpenseCreateDialog period={period} onClose={closeEntry} />
      ) : null}
    </>
  )
}
