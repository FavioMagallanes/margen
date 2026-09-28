import { Logout01FreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

import { useAuth } from "../use-auth"

export const LogoutButton = () => {
  const { signOut } = useAuth()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Cerrar sesión"
      onClick={() => void signOut()}
    >
      <HugeiconsIcon icon={Logout01FreeIcons} size={16} />
    </Button>
  )
}
