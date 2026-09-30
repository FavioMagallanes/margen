import type { ReactNode } from "react"

type StatusMessageProps = {
  title: string
  description: string
  fullScreen: boolean
  children: ReactNode
}

// Shared frame for the app's "nothing to show here" screens. `fullScreen` is for
// pages rendered outside AppShell; inside it the shell already provides the
// background and the navigation.
export const StatusMessage = ({
  title,
  description,
  fullScreen,
  children,
}: StatusMessageProps) => (
  <div
    className={
      fullScreen
        ? "flex min-h-svh items-center justify-center bg-background px-4 text-foreground"
        : "flex items-center justify-center px-4 py-16"
    }
  >
    <div className="flex max-w-sm flex-col items-center gap-4 text-center">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {children}
      </div>
    </div>
  </div>
)
