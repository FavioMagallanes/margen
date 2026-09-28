import { createContext } from "react"

import type { Session, User } from "@supabase/supabase-js"

// The UI only needs to know whether the attempt worked: Supabase error
// details must never reach the screen (they leak account existence).
export type SignInResult = { status: "success" } | { status: "error" }

export type AuthContextValue = {
  session: Session | null
  user: User | null
  /** True until the persisted session has been resolved on startup. */
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
)
