import { isRouteErrorResponse, Link, useRouteError } from "react-router"

import { Button, buttonVariants } from "@/components/ui/button"

import { NotFoundPage } from "./not-found-page"
import { StatusMessage } from "./status-message"

type RouteErrorPageProps = {
  fullScreen?: boolean
}

// Error boundary for routes (React Router's errorElement). The error itself is
// never shown: its message is technical and may not be meant for the user.
export const RouteErrorPage = ({ fullScreen = true }: RouteErrorPageProps) => {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage fullScreen={fullScreen} />
  }

  return (
    <StatusMessage
      fullScreen={fullScreen}
      title="Algo salió mal"
      description="Ocurrió un error inesperado. Podés reintentar o volver al inicio; tus datos guardados no se modificaron."
    >
      <Button size="lg" onClick={() => window.location.reload()}>
        Reintentar
      </Button>
      <Link
        to="/"
        className={buttonVariants({ size: "lg", variant: "outline" })}
      >
        Ir al inicio
      </Link>
    </StatusMessage>
  )
}
