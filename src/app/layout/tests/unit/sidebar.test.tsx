import { MemoryRouter } from "react-router"

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { DesktopTabs } from "@/app/layout/sidebar"

const NAV_LABELS = ["Presupuesto", "Próximos meses", "Reportes"]

describe("DesktopTabs", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  it("renderiza las 3 secciones de navegación", () => {
    render(
      <MemoryRouter initialEntries={["/months/2026/9"]}>
        <DesktopTabs period={{ year: 2026, month: 9 }} />
      </MemoryRouter>
    )

    const nav = screen.getByRole("navigation", { name: "Navegación principal" })

    for (const label of NAV_LABELS) {
      expect(within(nav).getByRole("tab", { name: label })).toBeDefined()
    }

    expect(within(nav).getAllByRole("tab")).toHaveLength(NAV_LABELS.length)
  })

  it("enlaza las secciones mensuales al período recibido", () => {
    render(
      <MemoryRouter initialEntries={["/months/2026/9"]}>
        <DesktopTabs period={{ year: 2026, month: 9 }} />
      </MemoryRouter>
    )

    expect(screen.getByRole("tab", { name: "Reportes" })).toHaveProperty(
      "pathname",
      "/reports"
    )
    expect(screen.getByRole("tab", { name: "Próximos meses" })).toHaveProperty(
      "pathname",
      "/months/2026/9/upcoming"
    )
  })
})
