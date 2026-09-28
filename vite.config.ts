import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
// Vitest reutiliza esta config de Vite; por eso el defineConfig viene de "vitest/config".
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    // Sin globals: cada test importa describe/it/expect de forma explícita.
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
