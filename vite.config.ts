import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
// Vitest reuses this Vite config, which is why defineConfig comes from "vitest/config".
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    // No globals: each test imports describe/it/expect explicitly.
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
