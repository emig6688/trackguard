import { test, expect } from "@playwright/test";
import { leerFixture } from "./fixture";

test.describe("Login", () => {
  test("credenciales correctas entran y redirigen al dashboard", async ({ page }) => {
    const { admin } = leerFixture();

    await page.goto("/login");
    await page.getByLabel("Usuario (email o DNI)").fill(admin.email);
    await page.getByLabel("Contraseña").fill(admin.password);
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("contraseña incorrecta muestra un error y no entra", async ({ page }) => {
    const { admin } = leerFixture();

    await page.goto("/login");
    await page.getByLabel("Usuario (email o DNI)").fill(admin.email);
    await page.getByLabel("Contraseña").fill("contraseña-equivocada");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("un usuario CHOFER que entra queda en /mobile/inicio, no en el dashboard de admin", async ({ page }) => {
    const { chofer } = leerFixture();

    await page.goto("/login");
    await page.getByLabel("Usuario (email o DNI)").fill(chofer.email);
    await page.getByLabel("Contraseña").fill(chofer.password);
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page).toHaveURL(/\/mobile\/inicio/);

    // Y si intenta entrar a mano a una pantalla de admin, el proxy lo manda de vuelta.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/mobile\/inicio/);
  });
});
