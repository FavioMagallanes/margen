import { MemoryRouter, Route, Routes, useLocation } from "react-router"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MonthSwitcher } from "@/app/layout/month-switcher"
import type { Period } from "@/shared/lib/period"

const LocationProbe = () => (
  <span data-testid="pathname">{useLocation().pathname}</span>
)

describe("MonthSwitcher", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(() => {
    // Real "today" fixed to 29/09/2026, so the real current month
    // (Septiembre) is deterministic.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29))
  })

  const renderWithProbe = (initialPath: string, period: Period) =>
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/months/:year/:month/*"
            element={
              <>
                <LocationProbe />
                <MonthSwitcher period={period} />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    )

  it("muestra «Mes anterior» habilitado en el mes calendario real", () => {
    renderWithProbe("/months/2026/9", { year: 2026, month: 9 })

    expect(screen.getByRole("button", { name: "Mes anterior" })).toHaveProperty(
      "disabled",
      false
    )
  })

  it("muestra «Mes anterior» habilitado también en un mes ya pasado", () => {
    renderWithProbe("/months/2026/7", { year: 2026, month: 7 })

    expect(screen.getByRole("button", { name: "Mes anterior" })).toHaveProperty(
      "disabled",
      false
    )
  })

  it("«Mes anterior» desde el mes real lleva al mes previo y conserva la sección", () => {
    renderWithProbe("/months/2026/9/upcoming", { year: 2026, month: 9 })

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }))

    expect(screen.getByTestId("pathname").textContent).toBe(
      "/months/2026/8/upcoming"
    )
  })

  it("«Mes anterior» cruza de enero a diciembre del año anterior", () => {
    renderWithProbe("/months/2026/1", { year: 2026, month: 1 })

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }))

    expect(screen.getByTestId("pathname").textContent).toBe("/months/2025/12")
  })

  it("«Mes siguiente» sigue llevando al mes posterior", () => {
    renderWithProbe("/months/2026/9", { year: 2026, month: 9 })

    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }))

    expect(screen.getByTestId("pathname").textContent).toBe("/months/2026/10")
  })

  it("«Hoy» lleva al mes calendario real (Septiembre) desde otro mes", () => {
    renderWithProbe("/months/2026/7", { year: 2026, month: 7 })

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }))

    expect(screen.getByTestId("pathname").textContent).toBe("/months/2026/9")
  })

  it("oculta «Hoy» en el mes calendario real, pero no en otro mes", () => {
    const { unmount } = renderWithProbe("/months/2026/9", {
      year: 2026,
      month: 9,
    })

    expect(screen.queryByRole("button", { name: "Hoy" })).toBeNull()
    unmount()

    renderWithProbe("/months/2026/10", { year: 2026, month: 10 })

    expect(screen.getByRole("button", { name: "Hoy" })).toBeTruthy()
  })
})
