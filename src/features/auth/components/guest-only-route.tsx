import { Navigate, useLocation } from "react-router"

import type { ReactNode } from "react"

import { resolvePathAfterLogin } from "../model/redirect"
import { useAuth } from "../use-auth"
import { AuthLoading } from "./auth-loading"

type GuestOnlyRouteProps = {
  children: ReactNode
}

export const GuestOnlyRoute = ({ children }: GuestOnlyRouteProps) => {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthLoading />
  }

  if (session !== null) {
    // Sending the user back to the blocked path keeps the deep link they
    // originally opened; without one, the current month is the app entry.
    return <Navigate to={resolvePathAfterLogin(location.state)} replace />
  }

  return children
}
