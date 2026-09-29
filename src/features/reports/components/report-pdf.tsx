import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import { formatArs } from "@/shared/lib/money"
import { formatPeriodLabel } from "@/shared/lib/period"

import type { ReportDocumentData } from "../model/report-document"
import {
  REPORT_CURRENCY_LABELS,
  REPORT_KIND_LABELS,
} from "../model/report-line"
import { formatScopeLabel } from "../model/report-scope"
import {
  formatOriginalAmount,
  formatUsd,
  MISSING_AMOUNT_LABEL,
} from "./report-amounts"

const generatedAtFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const describeExport = ({ isPartial, source }: ReportDocumentData): string => {
  if (!isPartial) {
    return "Alcance completo elegido"
  }

  return source === "selection"
    ? "Exportación parcial: selección manual de gastos"
    : "Exportación parcial: resultados de los filtros aplicados"
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: "#111827" },
  title: { fontSize: 16, marginBottom: 4 },
  headerLine: { fontSize: 9, color: "#4b5563", marginBottom: 2 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 11, marginBottom: 6 },
  headerRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
  },
  bodyRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  concept: { width: "26%" },
  group: { width: "18%" },
  kind: { width: "12%" },
  installment: { width: "10%" },
  amount: { width: "17%", textAlign: "right" },
  equivalent: { width: "17%", textAlign: "right" },
  estimated: { fontSize: 7, color: "#b45309" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    fontSize: 11,
  },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  note: { color: "#4b5563", marginTop: 4 },
  contextBlock: { marginTop: 6 },
})

type ReportPdfDocumentProps = {
  data: ReportDocumentData
}

export const ReportPdfDocument = ({ data }: ReportPdfDocumentProps) => (
  <Document title="Reporte de gastos de Margen">
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.title}>Reporte de gastos</Text>
      <Text style={styles.headerLine}>
        Períodos incluidos: {formatScopeLabel(data.scope)}
      </Text>
      <Text style={styles.headerLine}>
        Generado el {generatedAtFormatter.format(data.generatedAt)}
      </Text>
      <Text style={styles.headerLine}>{describeExport(data)}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gastos incluidos</Text>
        <View style={styles.headerRow} fixed>
          <Text style={styles.concept}>Concepto</Text>
          <Text style={styles.group}>Tarjeta o entidad</Text>
          <Text style={styles.kind}>Tipo</Text>
          <Text style={styles.installment}>Cuota</Text>
          <Text style={styles.amount}>Importe original</Text>
          <Text style={styles.equivalent}>Equivalente en ARS</Text>
        </View>
        {data.lines.map(({ line, arsEquivalent }) => (
          <View key={line.id} style={styles.bodyRow} wrap={false}>
            <View style={styles.concept}>
              <Text>{line.concept}</Text>
              <Text style={styles.headerLine}>
                {formatPeriodLabel({ year: line.year, month: line.month })}
              </Text>
              {line.amountIsEstimated ? (
                <Text style={styles.estimated}>Estimado</Text>
              ) : null}
            </View>
            <Text style={styles.group}>{line.group}</Text>
            <Text style={styles.kind}>{REPORT_KIND_LABELS[line.kind]}</Text>
            <Text style={styles.installment}>{line.installment ?? "—"}</Text>
            <Text style={styles.amount}>{formatOriginalAmount(line)}</Text>
            <Text style={styles.equivalent}>
              {/* An ARS line already is ARS: only USD lines need an
                  equivalent, converted with the rate of their own month. */}
              {line.currency !== "usd"
                ? "—"
                : arsEquivalent === null
                  ? MISSING_AMOUNT_LABEL
                  : formatArs(arsEquivalent)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subtotales por grupo y moneda</Text>
        {data.totals.subtotals.map((subtotal) => (
          <View
            key={`${subtotal.group}-${subtotal.currency ?? "sin-moneda"}`}
            style={styles.subtotalRow}
          >
            <Text>
              {subtotal.group} (
              {subtotal.currency === null
                ? "moneda desconocida"
                : REPORT_CURRENCY_LABELS[subtotal.currency]}
              ){subtotal.isComplete ? "" : " · incompleto"}
            </Text>
            <Text>
              {subtotal.currency === null || subtotal.originalAmount === null
                ? MISSING_AMOUNT_LABEL
                : subtotal.currency === "usd"
                  ? formatUsd(subtotal.originalAmount)
                  : formatArs(subtotal.originalAmount)}
            </Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text>Total</Text>
          <Text>{formatArs(data.totals.totalArs)}</Text>
        </View>
      </View>

      {data.salaryContext.length === 0 ? null : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Contexto del mes (no forma parte del total exportado)
          </Text>
          {data.salaryContext.map((context) => (
            <View
              key={`${context.period.year}-${context.period.month}`}
              style={styles.contextBlock}
            >
              <Text>{formatPeriodLabel(context.period)}</Text>
              <View style={styles.subtotalRow}>
                <Text>Sueldo del mes</Text>
                <Text>
                  {context.salaryArs === null
                    ? MISSING_AMOUNT_LABEL
                    : formatArs(context.salaryArs)}
                </Text>
              </View>
              <View style={styles.subtotalRow}>
                <Text>Gastos conocidos del mes</Text>
                <Text>{formatArs(context.monthExpensesArs)}</Text>
              </View>
              <View style={styles.subtotalRow}>
                <Text>Disponible del presupuesto</Text>
                <Text>
                  {context.availableArs === null
                    ? MISSING_AMOUNT_LABEL
                    : formatArs(context.availableArs)}
                </Text>
              </View>
              {context.isComplete ? null : (
                <Text style={styles.note}>
                  Este contexto está incompleto: falta el sueldo del mes o el
                  importe de algún gasto.
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      <Text
        style={styles.note}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
        fixed
      />
    </Page>
  </Document>
)
