import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type DuplicateCandidate,
  findPossibleDuplicate,
} from "@/shared/lib/duplicate-expense"
import { formatPeriodLabel, type Period } from "@/shared/lib/period"
import { AmountInput } from "@/shared/ui/amount-input"

import type { CardPurchaseBatchItem } from "../model/card-purchase-batch"
import {
  type CardPurchaseBatchItemErrors,
  type CardPurchaseBatchItemValues,
  emptyBatchItemValues,
  formatInvalidPositions,
  validateBatch,
  validateBatchItem,
} from "../model/card-purchase-batch"
import {
  toCardPurchaseCandidates,
  toCardPurchaseDraftCandidate,
} from "../model/card-purchase-duplicates"
import {
  CARD_OPTIONS,
  type CardOption,
  type CardPurchaseCurrency,
} from "../model/card-purchase-form"
import type { CardPurchaseRow } from "../model/card-purchase-groups"
import { DuplicateCardPurchaseDialog } from "./duplicate-card-purchase-dialog"

const EMPTY_BATCH_MESSAGE = "Agregá al menos una compra a la lista."

type SelectOption = {
  value: string
  label: string
}

const cardOptions: SelectOption[] = CARD_OPTIONS.map((card) => ({
  value: card,
  label: card,
}))

const currencyOptions: SelectOption[] = [
  { value: "ars", label: "Pesos (ARS)" },
  { value: "usd", label: "Dólares (USD)" },
]

const isCurrency = (value: string): value is CardPurchaseCurrency =>
  currencyOptions.some((option) => option.value === value)

const isCard = (value: string): value is CardOption =>
  CARD_OPTIONS.some((option) => option === value)

/** The Select root commits through `onValueChange`, not a change event. */
const SelectField = ({
  id,
  options,
  value,
  onValueChange,
}: {
  id: string
  options: SelectOption[]
  value: string
  onValueChange: (value: string) => void
}) => (
  <Select
    items={options}
    value={value}
    onValueChange={(selectedValue) => {
      if (selectedValue !== null) {
        onValueChange(selectedValue)
      }
    }}
  >
    <SelectTrigger id={id} className="h-7 w-full text-sm md:text-xs/relaxed">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

const FieldError = ({ message }: { message: string | undefined }) =>
  message === undefined ? null : (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )

type BatchItemFieldsProps = {
  idPrefix: string
  values: CardPurchaseBatchItemValues
  errors: CardPurchaseBatchItemErrors
  onChange: (values: CardPurchaseBatchItemValues) => void
}

/**
 * Every purchase of the list is its own mini form (RF-09), not a row of
 * editable cells, so the same fields are rendered for the draft and for each
 * item already added.
 */
const BatchItemFields = ({
  idPrefix,
  values,
  errors,
  onChange,
}: BatchItemFieldsProps) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-concept`} className="text-muted-foreground">
        Concepto
      </Label>
      <Input
        id={`${idPrefix}-concept`}
        autoComplete="off"
        aria-invalid={errors.concept !== undefined}
        value={values.concept}
        onChange={(event) =>
          onChange({ ...values, concept: event.target.value })
        }
      />
      <FieldError message={errors.concept} />
    </div>

    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-currency`} className="text-muted-foreground">
        Moneda
      </Label>
      <SelectField
        id={`${idPrefix}-currency`}
        options={currencyOptions}
        value={values.currency}
        onValueChange={(currency) => {
          if (isCurrency(currency)) {
            onChange({ ...values, currency })
          }
        }}
      />
      <FieldError message={errors.currency} />
    </div>

    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-amount`} className="text-muted-foreground">
        Importe de la cuota
      </Label>
      <AmountInput
        id={`${idPrefix}-amount`}
        autoComplete="off"
        className="font-mono"
        aria-invalid={errors.quotaAmount !== undefined}
        value={values.quotaAmount}
        onValueChange={(formattedValue) =>
          onChange({ ...values, quotaAmount: formattedValue })
        }
      />
      <FieldError message={errors.quotaAmount} />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={`${idPrefix}-starting-installment`}
          className="text-muted-foreground"
        >
          Cuota que se carga
        </Label>
        <Input
          id={`${idPrefix}-starting-installment`}
          type="number"
          min={1}
          inputMode="numeric"
          aria-invalid={errors.startingInstallment !== undefined}
          value={values.startingInstallment}
          onChange={(event) =>
            onChange({ ...values, startingInstallment: event.target.value })
          }
        />
        <FieldError message={errors.startingInstallment} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={`${idPrefix}-total-installments`}
          className="text-muted-foreground"
        >
          Total de cuotas
        </Label>
        <Input
          id={`${idPrefix}-total-installments`}
          type="number"
          min={1}
          inputMode="numeric"
          aria-invalid={errors.totalInstallments !== undefined}
          value={values.totalInstallments}
          onChange={(event) =>
            onChange({ ...values, totalInstallments: event.target.value })
          }
        />
        <FieldError message={errors.totalInstallments} />
      </div>
    </div>
  </div>
)

type BatchListItem = {
  id: number
  values: CardPurchaseBatchItemValues
}

type CardPurchaseBatchPanelProps = {
  /** RF-09: the month is fixed by the route for the whole batch. */
  period: Period
  existingRows: readonly CardPurchaseRow[]
  isSaving: boolean
  errorMessage: string | null
  onSave: (card: CardOption, items: readonly CardPurchaseBatchItem[]) => void
  onCancel: () => void
}

export const CardPurchaseBatchPanel = ({
  period,
  existingRows,
  isSaving,
  errorMessage,
  onSave,
  onCancel,
}: CardPurchaseBatchPanelProps) => {
  const [card, setCard] = useState<CardOption>("BBVA")
  const [items, setItems] = useState<BatchListItem[]>([])
  const [nextItemId, setNextItemId] = useState(1)
  const [draft, setDraft] = useState<CardPurchaseBatchItemValues>(
    emptyBatchItemValues()
  )
  const [draftErrors, setDraftErrors] = useState<CardPurchaseBatchItemErrors>(
    {}
  )
  const [errorsByIndex, setErrorsByIndex] = useState<
    Record<number, CardPurchaseBatchItemErrors>
  >({})
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    values: CardPurchaseBatchItemValues
    duplicate: DuplicateCandidate
  } | null>(null)

  const forgetBatchValidation = () => {
    setErrorsByIndex({})
    setBatchMessage(null)
  }

  const addItem = (values: CardPurchaseBatchItemValues) => {
    setItems((currentItems) => [...currentItems, { id: nextItemId, values }])
    setNextItemId((id) => id + 1)
    setDraft(emptyBatchItemValues())
    setDraftErrors({})
    forgetBatchValidation()
  }

  const handleAdd = () => {
    const result = validateBatchItem(draft)

    if (result.status === "invalid") {
      setDraftErrors(result.errors)
      return
    }

    setDraftErrors({})

    // RF-09: the warning looks at the month already on screen and also at the
    // purchases the user already put in this same list.
    const listCandidates = items.flatMap((item) => {
      const itemResult = validateBatchItem(item.values)

      return itemResult.status === "valid"
        ? [toCardPurchaseDraftCandidate({ ...itemResult.item, card, period })]
        : []
    })

    const duplicate = findPossibleDuplicate(
      toCardPurchaseDraftCandidate({ ...result.item, card, period }),
      [...toCardPurchaseCandidates(existingRows), ...listCandidates]
    )

    if (duplicate !== null) {
      setPendingDuplicate({ values: draft, duplicate })
      return
    }

    addItem(draft)
  }

  const confirmPendingDuplicate = () => {
    if (pendingDuplicate === null) {
      return
    }

    addItem(pendingDuplicate.values)
    setPendingDuplicate(null)
  }

  const updateItem = (id: number, values: CardPurchaseBatchItemValues) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, values } : item))
    )
    forgetBatchValidation()
  }

  const removeItem = (id: number) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== id))
    forgetBatchValidation()
  }

  const handleSaveBatch = () => {
    if (items.length === 0) {
      setBatchMessage(EMPTY_BATCH_MESSAGE)
      return
    }

    const validation = validateBatch(items.map((item) => item.values))

    if (validation.status === "invalid") {
      setErrorsByIndex(validation.errorsByIndex)
      setBatchMessage(formatInvalidPositions(validation.invalidPositions))
      return
    }

    forgetBatchValidation()
    onSave(card, validation.items)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="card-purchase-batch-card"
            className="text-muted-foreground"
          >
            Tarjeta del lote
          </Label>
          <SelectField
            id="card-purchase-batch-card"
            options={cardOptions}
            value={card}
            onValueChange={(selectedCard) => {
              if (isCard(selectedCard)) {
                setCard(selectedCard)
              }
            }}
          />
        </div>

        <p className="self-end text-xs text-muted-foreground">
          Todas las compras del lote se imputan a {formatPeriodLabel(period)}.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no agregaste compras al lote.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item, index) => (
            <li key={item.id}>
              <fieldset className="flex flex-col gap-3 rounded-md border p-4">
                <legend className="px-1 text-xs text-muted-foreground">
                  Compra {index + 1}
                </legend>
                <BatchItemFields
                  idPrefix={`card-purchase-batch-item-${item.id}`}
                  values={item.values}
                  errors={errorsByIndex[index] ?? {}}
                  onChange={(values) => updateItem(item.id, values)}
                />
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem(item.id)}
                  >
                    Quitar compra {index + 1}
                  </Button>
                </div>
              </fieldset>
            </li>
          ))}
        </ul>
      )}

      <fieldset className="flex flex-col gap-3 rounded-md border p-4">
        <legend className="px-1 text-xs text-muted-foreground">
          Nueva compra del lote
        </legend>
        <BatchItemFields
          idPrefix="card-purchase-batch-draft"
          values={draft}
          errors={draftErrors}
          onChange={(values) => setDraft(values)}
        />
        <div>
          <Button type="button" variant="secondary" onClick={handleAdd}>
            Agregar a la lista
          </Button>
        </div>
      </fieldset>

      {batchMessage === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{batchMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" disabled={isSaving} onClick={handleSaveBatch}>
          {isSaving ? "Guardando…" : "Guardar lote"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isSaving}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>

      <DuplicateCardPurchaseDialog
        duplicate={pendingDuplicate?.duplicate ?? null}
        onReview={() => setPendingDuplicate(null)}
        onSaveAnyway={confirmPendingDuplicate}
      />
    </div>
  )
}
