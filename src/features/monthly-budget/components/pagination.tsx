import { Button } from "@/components/ui/button"

type PaginationProps = {
  /** One-based page number, already clamped to the valid range. */
  page: number
  pageCount: number
  /** Names the controls for screen readers when several tables coexist. */
  label: string
  onPageChange: (page: number) => void
}

export const Pagination = ({
  page,
  pageCount,
  label,
  onPageChange,
}: PaginationProps) => (
  <nav
    aria-label={`Paginación de ${label}`}
    className="flex items-center justify-end gap-3 border-t px-4 py-2 text-sm"
  >
    <Button
      variant="outline"
      disabled={page <= 1}
      onClick={() => onPageChange(page - 1)}
    >
      Anterior
    </Button>
    <span className="text-muted-foreground">
      Página {page} de {pageCount}
    </span>
    <Button
      variant="outline"
      disabled={page >= pageCount}
      onClick={() => onPageChange(page + 1)}
    >
      Siguiente
    </Button>
  </nav>
)
