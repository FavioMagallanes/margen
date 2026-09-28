import { Navigate, Outlet, useLocation } from "react-router"

import { useAuth } from "../use-auth"
import { AuthLoading } from "./auth-loading"

export const RequireAuth = () => {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthLoading />
  }

  if (session === null) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
