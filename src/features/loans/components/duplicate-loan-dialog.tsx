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

type DuplicateLoanDialogProps = {
  /** The already loaded loan installment that looks like the draft, or null. */
  duplicate: DuplicateCandidate | null
  onReview: () => void
  onSaveAnyway: () => void
}

/**
 * RF-09: the warning only informs. «Revisar» leaves the loan unsaved so the
 * user can look at the row behind the dialog, and nothing is ever merged or
 * deleted automatically.
 */
export const DuplicateLoanDialog = ({
  duplicate,
  onReview,
  onSaveAnyway,
}: DuplicateLoanDialogProps) => (
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
        <AlertDialogTitle>¿Ya cargaste este préstamo?</AlertDialogTitle>
        <AlertDialogDescription>
          {duplicate === null
            ? null
            : `Ya existe un gasto muy parecido: «${duplicate.concept}» de ${duplicate.group}, ${formatArs(duplicate.amount)}, cuota ${duplicate.installment ?? "—"}. ¿Revisás el existente o cargás igual?`}
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
