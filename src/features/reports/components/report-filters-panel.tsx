import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { type ReportFilters, toggleFilterOption } from "../model/report-filters"
import {
  REPORT_CURRENCY_LABELS,
  REPORT_KIND_LABELS,
  type ReportCurrency,
  type ReportExpenseKind,
} from "../model/report-line"

const KIND_OPTIONS: readonly ReportExpenseKind[] = [
  "card_purchase",
  "loan",
  "recurring",
  "other",
]

const CURRENCY_OPTIONS: readonly ReportCurrency[] = ["ars", "usd"]

type FilterCheckboxProps = {
  id: string
  label: string
  isChecked: boolean
  onToggle: () => void
}

const FilterCheckbox = ({
  id,
  label,
  isChecked,
  onToggle,
}: FilterCheckboxProps) => (
  <div className="flex items-center gap-2">
    <Checkbox id={id} checked={isChecked} onCheckedChange={() => onToggle()} />
    <Label htmlFor={id}>{label}</Label>
  </div>
)

type ReportFiltersPanelProps = {
  filters: ReportFilters
  groupOptions: readonly string[]
  onFiltersChange: (filters: ReportFilters) => void
}

/**
 * RF-10: filtering only trims in memory what the scope already brought, so
 * every control here changes local state and never triggers a new query.
 */
export const ReportFiltersPanel = ({
  filters,
  groupOptions,
  onFiltersChange,
}: ReportFiltersPanelProps) => (
  <Card>
    <CardContent className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Filtros</p>

      <div className="flex flex-col gap-1">
        <Label htmlFor="report-filter-concept">Concepto</Label>
        <Input
          id="report-filter-concept"
          autoComplete="off"
          className="max-w-xs"
          value={filters.concept}
          onChange={(event) =>
            onFiltersChange({ ...filters, concept: event.target.value })
          }
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted-foreground">Tipo de gasto</legend>
        <div className="flex flex-wrap gap-4">
          {KIND_OPTIONS.map((kind) => (
            <FilterCheckbox
              key={kind}
              id={`report-filter-kind-${kind}`}
              label={REPORT_KIND_LABELS[kind]}
              isChecked={filters.kinds.includes(kind)}
              onToggle={() =>
                onFiltersChange({
                  ...filters,
                  kinds: toggleFilterOption(filters.kinds, kind),
                })
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted-foreground">
          Tarjeta o entidad
        </legend>
        {groupOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay tarjetas ni entidades en este alcance.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {groupOptions.map((group) => (
              <FilterCheckbox
                key={group}
                id={`report-filter-group-${group}`}
                label={group}
                isChecked={filters.groups.includes(group)}
                onToggle={() =>
                  onFiltersChange({
                    ...filters,
                    groups: toggleFilterOption(filters.groups, group),
                  })
                }
              />
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted-foreground">
          Moneda original
        </legend>
        <div className="flex flex-wrap gap-4">
          {CURRENCY_OPTIONS.map((currency) => (
            <FilterCheckbox
              key={currency}
              id={`report-filter-currency-${currency}`}
              label={REPORT_CURRENCY_LABELS[currency]}
              isChecked={filters.currencies.includes(currency)}
              onToggle={() =>
                onFiltersChange({
                  ...filters,
                  currencies: toggleFilterOption(filters.currencies, currency),
                })
              }
            />
          ))}
        </div>
      </fieldset>
    </CardContent>
  </Card>
)
