import { expect, test } from "@playwright/test"

test("la home muestra el encabezado Margen", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Margen" })).toBeVisible()
})
