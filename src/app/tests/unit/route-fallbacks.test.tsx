import { createMemoryRouter, RouterProvider } from "react-router"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { NotFoundPage } from "@/app/pages/not-found-page"
import { RouteErrorPage } from "@/app/pages/route-error-page"

const Boom = (): never => {
  throw new Error("boom")
}

describe("pantallas de respaldo de rutas", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("muestra la página 404 con un enlace al inicio para una ruta desconocida", () => {
    const router = createMemoryRouter(
      [{ path: "*", element: <NotFoundPage /> }],
      { initialEntries: ["/no-existe"] }
    )

    render(<RouterProvider router={router} />)

    expect(
      screen.getByRole("heading", { name: "Página no encontrada" })
    ).toBeDefined()
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveProperty(
      "pathname",
      "/"
    )
  })

  it("muestra el error genérico, sin exponer el detalle, cuando una ruta falla al renderizar", () => {
    // React and React Router log the caught render error; keep the output clean.
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    const router = createMemoryRouter(
      [{ path: "/", element: <Boom />, errorElement: <RouteErrorPage /> }],
      { initialEntries: ["/"] }
    )

    render(<RouterProvider router={router} />)

    expect(
      screen.getByRole("heading", { name: "Algo salió mal" })
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined()
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toBeDefined()
    expect(screen.queryByText(/boom/)).toBeNull()
  })

  it("trata una respuesta 404 lanzada por una ruta como página no encontrada", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          loader: () => {
            throw new Response("", { status: 404 })
          },
          element: <p>contenido</p>,
          errorElement: <RouteErrorPage />,
        },
      ],
      { initialEntries: ["/"] }
    )

    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole("heading", { name: "Página no encontrada" })
    ).toBeDefined()
  })
})
