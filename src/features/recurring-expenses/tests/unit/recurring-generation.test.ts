import { describe, expect, it } from "vitest"

import {
  buildRecurringGenerationDrafts,
  parseRecurringGenerationDrafts,
} from "@/features/recurring-expenses/model/recurring-generation"
import type { PendingRecurringPlan } from "@/features/recurring-expenses/model/recurring-plans"

const fixedPlan: PendingRecurringPlan = {
  planId: "plan-fixed",
  concept: "Internet",
  groupLabel: "Otros gastos",
  currency: "ars",
  defaultAmount: 45_000,
  lastKnownAmount: 45_000,
}

const variablePlan: PendingRecurringPlan = {
  planId: "plan-variable",
  concept: "Luz",
  groupLabel: "Otros gastos",
  currency: "ars",
  defaultAmount: null,
  lastKnownAmount: 32_500,
}

const firstTimePlan: PendingRecurringPlan = {
  ...variablePlan,
  planId: "plan-new",
  lastKnownAmount: null,
}

describe("buildRecurringGenerationDrafts", () => {
  it("prellena el importe fijo sin marcarlo como estimado", () => {
    expect(buildRecurringGenerationDrafts([fixedPlan])["plan-fixed"]).toEqual({
      action: "fill",
      amount: "45.000,00",
      isEstimated: false,
    })
  })

  it("prellena el variable con el último importe real y lo marca estimado", () => {
    expect(
      buildRecurringGenerationDrafts([variablePlan])["plan-variable"]
    ).toEqual({ action: "fill", amount: "32.500,00", isEstimated: true })
  })

  it("arranca vacío cuando el variable no tiene de dónde estimar", () => {
    expect(buildRecurringGenerationDrafts([firstTimePlan])["plan-new"]).toEqual(
      { action: "fill", amount: "", isEstimated: false }
    )
  })
})

describe("parseRecurringGenerationDrafts", () => {
  it("arma un ítem por cada decisión: cargar importe u omitir el mes", () => {
    const result = parseRecurringGenerationDrafts([fixedPlan, variablePlan], {
      "plan-fixed": { action: "fill", amount: "45.000", isEstimated: false },
      "plan-variable": { action: "skip", amount: "32.500", isEstimated: true },
    })

    expect(result).toEqual({
      status: "valid",
      items: [
        {
          planId: "plan-fixed",
          action: "fill",
          amount: 45_000,
          isEstimated: false,
        },
        {
          planId: "plan-variable",
          action: "skip",
          amount: null,
          isEstimated: false,
        },
      ],
    })
  })

  it("conserva la marca de estimado del importe prellenado", () => {
    const result = parseRecurringGenerationDrafts(
      [variablePlan],
      buildRecurringGenerationDrafts([variablePlan])
    )

    expect(result).toEqual({
      status: "valid",
      items: [
        {
          planId: "plan-variable",
          action: "fill",
          amount: 32_500,
          isEstimated: true,
        },
      ],
    })
  })

  it("no genera el mes de un recurrente que quedó sin importe", () => {
    const result = parseRecurringGenerationDrafts([fixedPlan, variablePlan], {
      "plan-fixed": { action: "fill", amount: "45.000", isEstimated: false },
      "plan-variable": { action: "fill", amount: "  ", isEstimated: false },
    })

    expect(result.status).toBe("valid")
    expect(result.status === "valid" && result.items).toHaveLength(1)
  })

  it("avisa cuando no se decidió nada", () => {
    expect(
      parseRecurringGenerationDrafts([fixedPlan], {
        "plan-fixed": { action: "fill", amount: "", isEstimated: false },
      })
    ).toEqual({ status: "empty" })
  })

  it("rechaza un importe en cero en vez de generarlo", () => {
    const result = parseRecurringGenerationDrafts([fixedPlan], {
      "plan-fixed": { action: "fill", amount: "0", isEstimated: false },
    })

    expect(result.status).toBe("invalid")
    expect(result.status === "invalid" && result.errors["plan-fixed"]).toBe(
      "Ingresá un importe mayor a cero o dejá el mes vacío"
    )
  })
})
