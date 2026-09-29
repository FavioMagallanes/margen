import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { GuestOnlyRoute } from "@/features/auth/components/guest-only-route"
import { RequireAuth } from "@/features/auth/components/require-auth"
import { createFakeSession } from "@/features/auth/tests/fixtures/session"
import { getWorkingPeriod } from "@/shared/lib/period"

const { authMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
}))

vi.mock("@/shared/lib/supabase/client", () => ({
  supabase: { auth: authMock },
}))

const MonthScreen = () => {
  const { year, month } = useParams()

  return <p>{`Presupuesto protegido de ${year}/${month}`}</p>
}

const LoginScreen = () => {
  const { state } = useLocation()
  const from =
    typeof state === "object" && state !== null && "from" in state
      ? String(state.from)
      : "sin origen"

  return (
    <div>
      <p>Pantalla de ingreso</p>
      <p>Origen: {from}</p>
    </div>
  )
}

type InitialEntry = string | { pathname: string; state: { from: string } }

const renderRoutes = (initialEntry: InitialEntry) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/login"
              element={
                <GuestOnlyRoute>
                  <LoginScreen />
                </GuestOnlyRoute>
              }
            />
            <Route element={<RequireAuth />}>
              <Route path="/months/:year/:month" element={<MonthScreen />} />
              <Route path="/reports" element={<p>Reportes protegidos</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe("guard de rutas", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  const withSession = (
    session: ReturnType<typeof createFakeSession> | null
  ) => {
    authMock.getSession.mockResolvedValue({ data: { session }, error: null })
  }

  it("sin sesión, una ruta protegida redirige al login conservando el destino", async () => {
    withSession(null)

    renderRoutes("/months/2026/3")

    expect(await screen.findByText("Pantalla de ingreso")).toBeDefined()
    expect(screen.getByText("Origen: /months/2026/3")).toBeDefined()
  })

  it("sin sesión, los reportes también quedan protegidos", async () => {
    withSession(null)

    renderRoutes("/reports")

    expect(await screen.findByText("Pantalla de ingreso")).toBeDefined()
    expect(screen.queryByText("Reportes protegidos")).toBeNull()
  })

  it("con sesión, la ruta protegida se renderiza", async () => {
    withSession(createFakeSession())

    renderRoutes("/months/2026/3")

    expect(
      await screen.findByText("Presupuesto protegido de 2026/3")
    ).toBeDefined()
  })

  it("con sesión, el login redirige al mes de trabajo", async () => {
    withSession(createFakeSession())

    renderRoutes("/login")

    const { year, month } = getWorkingPeriod()

    expect(
      await screen.findByText(`Presupuesto protegido de ${year}/${month}`)
    ).toBeDefined()
    expect(screen.queryByText("Pantalla de ingreso")).toBeNull()
  })

  it("con sesión, el login vuelve al destino original bloqueado", async () => {
    withSession(createFakeSession())

    renderRoutes({ pathname: "/login", state: { from: "/reports" } })

    expect(await screen.findByText("Reportes protegidos")).toBeDefined()
  })
})
