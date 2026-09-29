import { MemoryRouter, Route, Routes, useLocation } from "react-router"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MonthSwitcher } from "@/app/layout/month-switcher"

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
    // Real "today" fixed to 29/09/2026, so the working month (Octubre) and
    // the real current month (Septiembre) are both deterministic.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29))
  })

  it("oculta «Mes anterior» al llegar al mes calendario real", () => {
    render(
      <MemoryRouter initialEntries={["/months/2026/9"]}>
        <MonthSwitcher period={{ year: 2026, month: 9 }} />
      </MemoryRouter>
    )

    expect(screen.queryByRole("button", { name: "Mes anterior" })).toBeNull()
  })

  it("muestra «Mes anterior» en el mes de trabajo, que todavía puede volver al mes real", () => {
    render(
      <MemoryRouter initialEntries={["/months/2026/10"]}>
        <MonthSwitcher period={{ year: 2026, month: 10 }} />
      </MemoryRouter>
    )

    expect(screen.getByRole("button", { name: "Mes anterior" })).toHaveProperty(
      "disabled",
      false
    )
  })

  it("también oculta «Mes anterior» en un mes ya pasado, guardado de antes", () => {
    render(
      <MemoryRouter initialEntries={["/months/2026/7"]}>
        <MonthSwitcher period={{ year: 2026, month: 7 }} />
      </MemoryRouter>
    )

    // Julio ya quedó atrás del mes real (septiembre): la flecha no deja
    // retroceder más, aunque llegar acá haya sido por una URL guardada.
    expect(screen.queryByRole("button", { name: "Mes anterior" })).toBeNull()
  })

  it("«Hoy» lleva al mes calendario real (Septiembre) desde el mes de trabajo (Octubre)", () => {
    render(
      <MemoryRouter initialEntries={["/months/2026/10"]}>
        <Routes>
          <Route
            path="/months/:year/:month"
            element={
              <>
                <LocationProbe />
                <MonthSwitcher period={{ year: 2026, month: 10 }} />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }))

    expect(screen.getByTestId("pathname").textContent).toBe("/months/2026/9")
  })

  it("oculta «Hoy» en el mes calendario real, pero no en el mes de trabajo", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/months/2026/9"]}>
        <MonthSwitcher period={{ year: 2026, month: 9 }} />
      </MemoryRouter>
    )

    expect(screen.queryByRole("button", { name: "Hoy" })).toBeNull()
    unmount()

    render(
      <MemoryRouter initialEntries={["/months/2026/10"]}>
        <MonthSwitcher period={{ year: 2026, month: 10 }} />
      </MemoryRouter>
    )

    expect(screen.getByRole("button", { name: "Hoy" })).toBeTruthy()
  })
})
