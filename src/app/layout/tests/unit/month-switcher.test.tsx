import { MemoryRouter } from "react-router"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MonthSwitcher } from "@/app/layout/month-switcher"

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

  it("deshabilita «Mes anterior» al llegar al mes calendario real", () => {
    render(
      <MemoryRouter initialEntries={["/months/2026/9"]}>
        <MonthSwitcher period={{ year: 2026, month: 9 }} />
      </MemoryRouter>
    )

    expect(screen.getByRole("button", { name: "Mes anterior" })).toHaveProperty(
      "disabled",
      true
    )
  })

  it("no deshabilita «Mes anterior» en el mes de trabajo, que todavía puede volver al mes real", () => {
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

  it("también deshabilita «Mes anterior» en un mes ya pasado, guardado de antes", () => {
    render(
      <MemoryRouter initialEntries={["/months/2026/7"]}>
        <MonthSwitcher period={{ year: 2026, month: 7 }} />
      </MemoryRouter>
    )

    // Julio ya quedó atrás del mes real (septiembre): la flecha no deja
    // retroceder más, aunque llegar acá haya sido por una URL guardada.
    expect(screen.getByRole("button", { name: "Mes anterior" })).toHaveProperty(
      "disabled",
      true
    )
  })
})
