import { Link } from "react-router"

import { buttonVariants } from "@/components/ui/button"

import { StatusMessage } from "./status-message"

type NotFoundPageProps = {
  fullScreen?: boolean
}

export const NotFoundPage = ({ fullScreen = true }: NotFoundPageProps) => (
  <StatusMessage
    fullScreen={fullScreen}
    title="Página no encontrada"
    description="La dirección que abriste no existe o ya no está disponible."
  >
    <Link to="/" className={buttonVariants({ size: "lg" })}>
      Ir al inicio
    </Link>
  </StatusMessage>
)
