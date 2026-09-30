import { createMemoryRouter, RouterProvider } from "react-router"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AppShell } from "@/app/layout/app-shell"

vi.mock("@/features/auth/components/logout-button", () => ({
  LogoutButton: () => null,
}))

vi.mock("@/app/layout/theme-toggle", () => ({ ThemeToggle: () => null }))

describe("AppShell navigation", () => {
  afterEach(cleanup)

  it("vuelve al mes que se estaba viendo tras pasar por Reportes", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 15))

    const router = createMemoryRouter(
      [
        {
          path: "/months/:year/:month",
          element: <AppShell />,
          children: [{ index: true, element: <p>budget</p> }],
        },
        {
          path: "/reports",
          element: <AppShell />,
          children: [{ index: true, element: <p>reports</p> }],
        },
      ],
      { initialEntries: ["/months/2026/9"] }
    )

    render(<RouterProvider router={router} />)

    fireEvent.click(screen.getByRole("tab", { name: "Reportes" }))
    expect(router.state.location.pathname).toBe("/reports")

    fireEvent.click(screen.getByRole("tab", { name: "Presupuesto" }))
    expect(router.state.location.pathname).toBe("/months/2026/9")

    vi.useRealTimers()
  })
})
