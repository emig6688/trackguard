import type { Page } from "@playwright/test";

export async function login(page: Page, usuario: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Usuario (email o DNI)").fill(usuario);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}
