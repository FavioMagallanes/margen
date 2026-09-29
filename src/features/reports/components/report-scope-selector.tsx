import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Period } from "@/shared/lib/period"

export type ReportScopeKind = "month" | "range" | "all"

const SCOPE_OPTIONS: readonly { kind: ReportScopeKind; label: string }[] = [
  { kind: "month", label: "Mes actual" },
  { kind: "range", label: "Rango de meses" },
  { kind: "all", label: "Todo el historial" },
]

type PeriodFieldsProps = {
  idPrefix: string
  legend: string
  monthLabel: string
  yearLabel: string
  period: Period
  onChange: (period: Period) => void
}

const PeriodFields = ({
  idPrefix,
  legend,
  monthLabel,
  yearLabel,
  period,
  onChange,
}: PeriodFieldsProps) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs text-muted-foreground">{legend}</p>
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-month`}>{monthLabel}</Label>
        <Input
          id={`${idPrefix}-month`}
          type="number"
          min={1}
          max={12}
          inputMode="numeric"
          className="w-20"
          value={String(period.month)}
          onChange={(event) =>
            onChange({ ...period, month: Number(event.target.value) })
          }
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-year`}>{yearLabel}</Label>
        <Input
          id={`${idPrefix}-year`}
          type="number"
          min={2000}
          inputMode="numeric"
          className="w-28"
          value={String(period.year)}
          onChange={(event) =>
            onChange({ ...period, year: Number(event.target.value) })
          }
        />
      </div>
    </div>
  </div>
)

type ReportScopeSelectorProps = {
  scopeKind: ReportScopeKind
  rangeStart: Period
  rangeEnd: Period
  scopeLabel: string | null
  rangeError: string | null
  onScopeKindChange: (scopeKind: ReportScopeKind) => void
  onRangeStartChange: (period: Period) => void
  onRangeEndChange: (period: Period) => void
}

export const ReportScopeSelector = ({
  scopeKind,
  rangeStart,
  rangeEnd,
  scopeLabel,
  rangeError,
  onScopeKindChange,
  onRangeStartChange,
  onRangeEndChange,
}: ReportScopeSelectorProps) => (
  <Card>
    <CardContent className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Alcance de la consulta</p>

      <div className="flex flex-wrap gap-2">
        {SCOPE_OPTIONS.map((option) => (
          <Button
            key={option.kind}
            type="button"
            variant={option.kind === scopeKind ? "default" : "outline"}
            aria-pressed={option.kind === scopeKind}
            onClick={() => onScopeKindChange(option.kind)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {scopeKind === "range" ? (
        <div className="flex flex-wrap gap-6">
          <PeriodFields
            idPrefix="report-range-start"
            legend="Desde"
            monthLabel="Mes desde"
            yearLabel="Año desde"
            period={rangeStart}
            onChange={onRangeStartChange}
          />
          <PeriodFields
            idPrefix="report-range-end"
            legend="Hasta"
            monthLabel="Mes hasta"
            yearLabel="Año hasta"
            period={rangeEnd}
            onChange={onRangeEndChange}
          />
        </div>
      ) : null}

      {rangeError === null ? (
        <p className="text-sm text-foreground">
          Consultando: <strong>{scopeLabel}</strong>
        </p>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {rangeError}
        </p>
      )}
    </CardContent>
  </Card>
)
