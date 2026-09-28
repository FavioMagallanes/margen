import { useParams } from "react-router"

import {
  formatPeriodLabel,
  getCurrentPeriod,
  parsePeriod,
} from "@/shared/lib/period"

type Currency = "ARS" | "USD"

type SummaryCard = {
  label: string
  amountArs: number
  /** Only card groups show the USD side of their consumption. */
  amountUsd: number | null
}

type ExpenseRow = {
  id: string
  concept: string
  group: string
  installment: string | null
  originalAmount: number
  originalCurrency: Currency
  amountArs: number
}

// Placeholder figures until the Supabase domain layer lands.
const SALARY_ARS = 1_850_000
const AVAILABLE_ARS = 703_500
const CARD_EXCHANGE_RATE = 1_640

const SUMMARY_CARDS: SummaryCard[] = [
  { label: "BBVA", amountArs: 512_400, amountUsd: 124.9 },
  { label: "Supervielle", amountArs: 298_100, amountUsd: 42.5 },
  { label: "Préstamos", amountArs: 336_000, amountUsd: null },
]

const EXPENSE_ROWS: ExpenseRow[] = [
  {
    id: "notebook",
    concept: "Notebook",
    group: "BBVA",
    installment: "3/6",
    originalAmount: 45_000,
    originalCurrency: "ARS",
    amountArs: 45_000,
  },
  {
    id: "hosting",
    concept: "Hosting anual",
    group: "BBVA",
    installment: null,
    originalAmount: 62,
    originalCurrency: "USD",
    amountArs: 101_680,
  },
  {
    id: "seguro",
    concept: "Seguro del auto",
    group: "Supervielle",
    installment: null,
    originalAmount: 78_400,
    originalCurrency: "ARS",
    amountArs: 78_400,
  },
  {
    id: "streaming",
    concept: "Streaming familiar",
    group: "Supervielle",
    installment: null,
    originalAmount: 12.99,
    originalCurrency: "USD",
    amountArs: 21_303,
  },
  {
    id: "prestamo-personal",
    concept: "Préstamo personal",
    group: "Préstamos",
    installment: "8/24",
    originalAmount: 186_000,
    originalCurrency: "ARS",
    amountArs: 186_000,
  },
  {
    id: "heladera",
    concept: "Heladera",
    group: "BBVA",
    installment: "2/12",
    originalAmount: 98_500,
    originalCurrency: "ARS",
    amountArs: 98_500,
  },
]

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
})

const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const formatAmount = (amount: number, currency: Currency) =>
  currency === "ARS" ? arsFormatter.format(amount) : usdFormatter.format(amount)

export const MonthlyBudgetPage = () => {
  const { year, month } = useParams()
  const period = parsePeriod(year, month) ?? getCurrentPeriod()

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">
          Sueldo de {formatPeriodLabel(period)}
        </p>
        <p className="font-mono text-sm text-foreground">
          {arsFormatter.format(SALARY_ARS)}
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          Disponible del presupuesto
        </p>
        <p className="font-mono text-4xl font-semibold tracking-tight text-primary">
          {arsFormatter.format(AVAILABLE_ARS)}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {SUMMARY_CARDS.map((card) => (
          <article
            key={card.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="font-mono text-xl font-medium">
              {arsFormatter.format(card.amountArs)}
            </p>
            {card.amountUsd === null ? null : (
              <p className="font-mono text-xs text-muted-foreground">
                {usdFormatter.format(card.amountUsd)} · dólar tarjeta{" "}
                {arsFormatter.format(CARD_EXCHANGE_RATE)}
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              Gastos de {formatPeriodLabel(period)}
            </caption>
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Concepto
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Grupo
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Cuota
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Importe original
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Equivalente en ARS
                </th>
              </tr>
            </thead>
            <tbody>
              {EXPENSE_ROWS.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2">{row.concept}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.group}
                  </td>
                  <td className="px-4 py-2">
                    {row.installment === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-xs">
                        {row.installment}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatAmount(row.originalAmount, row.originalCurrency)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {arsFormatter.format(row.amountArs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
