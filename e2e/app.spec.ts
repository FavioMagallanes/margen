import { expect, test } from "@playwright/test"

// Every month/report route now requires a session (RF-13), and there is no
// disposable Supabase test user wired into e2e yet, so this only checks the
// login redirect and form. Once an authenticated e2e strategy exists, restore
// coverage of the real budget shell content here.
test("la home sin sesión redirige al login y muestra el formulario", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/login$/)

  await expect(page.getByRole("heading", { name: "Margen" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Contraseña")).toBeVisible()
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible()
})
