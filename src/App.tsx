import { RouterProvider } from "react-router/dom"

import { router } from "@/app/router"
import { NoiseTexture } from "@/components/ui/noise-texture"

export const App = () => (
  <>
    {/* One fixed grain layer above every view (login, shell, 404, errors);
        it ignores pointer events so it never blocks the UI. */}
    <NoiseTexture
      className="fixed z-50 opacity-30 dark:opacity-40"
      octaves={4}
    />
    <RouterProvider router={router} />
  </>
)
