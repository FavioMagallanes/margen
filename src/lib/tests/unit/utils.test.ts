import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"

describe("cn", () => {
  it("combina clases y descarta las condicionales desactivadas", () => {
    expect(cn("flex", { hidden: false }, undefined, "p-6")).toBe("flex p-6")
  })

  it("resuelve conflictos de Tailwind quedándose con la última clase", () => {
    expect(cn("p-2", "p-6")).toBe("p-6")
  })
})
