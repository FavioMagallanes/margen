import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { DuplicateCandidate } from "@/shared/lib/duplicate-expense"
import { formatArs } from "@/shared/lib/money"

type DuplicateRecurringDialogProps = {
  /** The already generated month that looks like the draft, or null. */
  duplicate: DuplicateCandidate | null
  onReview: () => void
  onSaveAnyway: () => void
}

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const formatAmount = ({ amount, currency }: DuplicateCandidate): string =>
  currency === "usd" ? usdFormatter.format(amount) : formatArs(amount)

/**
 * RF-09: the warning only informs. «Revisar» leaves the recurring expense
 * unsaved so the user can look at the row behind the dialog, and nothing is
 * ever merged or deleted automatically.
 */
export const DuplicateRecurringDialog = ({
  duplicate,
  onReview,
  onSaveAnyway,
}: DuplicateRecurringDialogProps) => (
  <AlertDialog
    open={duplicate !== null}
    onOpenChange={(open) => {
      if (!open) {
        onReview()
      }
    }}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>¿Ya cargaste este recurrente?</AlertDialogTitle>
        <AlertDialogDescription>
          {duplicate === null
            ? null
            : `Ya existe un gasto muy parecido: «${duplicate.concept}» en ${duplicate.group}, ${formatAmount(duplicate)}. ¿Revisás el existente o cargás igual?`}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Revisar</AlertDialogCancel>
        <AlertDialogAction onClick={onSaveAnyway}>
          Cargar igual
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
