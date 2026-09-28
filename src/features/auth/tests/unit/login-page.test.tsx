import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { LoginPage } from "@/features/auth/components/login-page"

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

const renderLoginPage = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </QueryClientProvider>
  )

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeDefined()
  })
}

const fillForm = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } })
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: password },
  })
}

const submitForm = () => {
  fireEvent.click(screen.getByRole("button", { name: "Ingresar" }))
}

describe("LoginPage", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    authMock.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    })
  })

  it("rechaza un email inválido sin intentar iniciar sesión", async () => {
    await renderLoginPage()

    fillForm("no-es-un-email", "secreto123")
    submitForm()

    expect(await screen.findByText("Ingresá un email válido")).toBeDefined()
    expect(authMock.signInWithPassword).not.toHaveBeenCalled()
  })

  it("rechaza una contraseña vacía sin intentar iniciar sesión", async () => {
    await renderLoginPage()

    fillForm("persona@example.test", "")
    submitForm()

    expect(await screen.findByText("Ingresá tu contraseña")).toBeDefined()
    expect(authMock.signInWithPassword).not.toHaveBeenCalled()
  })

  it("envía las credenciales válidas a Supabase", async () => {
    await renderLoginPage()

    fillForm("persona@example.test", "secreto123")
    submitForm()

    await waitFor(() => {
      expect(authMock.signInWithPassword).toHaveBeenCalledWith({
        email: "persona@example.test",
        password: "secreto123",
      })
    })
  })

  it("muestra un mensaje genérico sin filtrar el error de Supabase", async () => {
    authMock.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials", status: 400 },
    })

    await renderLoginPage()

    fillForm("persona@example.test", "clave-incorrecta")
    submitForm()

    expect(
      await screen.findByText(
        "No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo."
      )
    ).toBeDefined()
    expect(screen.queryByText(/Invalid login credentials/)).toBeNull()
  })
})
