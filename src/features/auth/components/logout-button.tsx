import { Logout01FreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

import { useAuth } from "../use-auth"

export const LogoutButton = () => {
  const { signOut } = useAuth()

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label="Cerrar sesión"
      onClick={() => void signOut()}
    >
      <HugeiconsIcon icon={Logout01FreeIcons} size={20} className="size-5" />
    </Button>
  )
}
