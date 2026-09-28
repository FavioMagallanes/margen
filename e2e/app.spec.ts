import { expect, test } from "@playwright/test"

test("la home redirige al mes actual y muestra el presupuesto", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/months\/\d{4}\/\d{1,2}$/)

  const nav = page.getByRole("navigation", { name: "Navegación principal" })
  for (const label of [
    "Presupuesto",
    "Tarjetas",
    "Préstamos",
    "Recurrentes",
    "Reportes",
  ]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible()
  }

  await expect(page.getByText("Disponible del presupuesto")).toBeVisible()
})
