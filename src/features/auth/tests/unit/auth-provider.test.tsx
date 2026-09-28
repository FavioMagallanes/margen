import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { createFakeSession } from "@/features/auth/tests/fixtures/session"
import { useAuth } from "@/features/auth/use-auth"

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

const SignOutButton = () => {
  const { signOut } = useAuth()

  return (
    <button type="button" onClick={() => void signOut()}>
      Cerrar sesión
    </button>
  )
}

describe("AuthProvider", () => {
  // Vitest runs without globals, so Testing Library's auto cleanup is not registered.
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.getSession.mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    })
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    authMock.signOut.mockResolvedValue({ error: null })
  })

  it("clears every cached query on sign-out so the next session starts clean", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    // A previous owner's data left in the cache, e.g. a budget query.
    queryClient.setQueryData(["monthly-budget", "user-1", "budget", 2026, 3], {
      salaryArs: 1_000_000,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SignOutButton />
        </AuthProvider>
      </QueryClientProvider>
    )

    screen.getByText("Cerrar sesión").click()

    await waitFor(() => {
      expect(authMock.signOut).toHaveBeenCalled()
    })

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
