import { test, expect } from "@playwright/test";
import { leerFixture } from "./fixture";
import { login } from "./login-helper";

/**
 * Cubre el flujo real completo que motivó uno de los hallazgos de la
 * auditoría (checklists.ts no respetaba el toggle de auto-aprobación): un
 * chofer reporta una falla en el checklist pre-salida, eso genera una OT
 * "Pendiente de aprobación" (la empresa E2E no tiene auto-aprobación
 * activada), y un administrador la aprueba asignándole un mecánico.
 */
test("chofer reporta una falla en el checklist y el admin aprueba la OT generada", async ({ browser }) => {
  const fixture = leerFixture();

  const choferContext = await browser.newContext();
  const choferPage = await choferContext.newPage();
  await login(choferPage, fixture.chofer.email, fixture.chofer.password);
  await expect(choferPage).toHaveURL(/\/mobile\/inicio/);

  await choferPage.goto("/mobile/checklist");
  await choferPage.getByLabel("Vehículo").selectOption({ label: fixture.vehiculoPatente });

  const item = choferPage.locator("fieldset", { hasText: fixture.checklistItemTexto });
  await item.getByLabel("Falla").check();

  await choferPage.getByRole("button", { name: "Enviar checklist" }).click();
  await expect(choferPage).toHaveURL(/\/mobile\/checklist\/listo\?fallas=1/);
  await choferContext.close();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, fixture.admin.email, fixture.admin.password);
  await expect(adminPage).toHaveURL(/\/dashboard/);

  await adminPage.goto("/ordenes-trabajo");
  const fila = adminPage.locator("tr", { hasText: "Fallas detectadas en checklist pre-salida" });
  await expect(fila).toBeVisible();
  await fila.getByRole("link").first().click();
  await adminPage.waitForURL(/\/ordenes-trabajo\/[a-zA-Z0-9]+$/);

  await expect(adminPage.getByRole("heading", { name: /Fallas detectadas en checklist pre-salida/ })).toBeVisible();

  await adminPage.getByLabel("Asignar a mecánico").click();
  await adminPage.getByRole("option", { name: fixture.mecanico.nombre }).click();
  await adminPage.getByLabel("Fecha límite").fill("2027-01-01");
  await adminPage.getByRole("button", { name: "Aprobar" }).click();

  await expect(adminPage.getByText("Orden aprobada y asignada.")).toBeVisible();
  await expect(adminPage.getByText("Aprobada", { exact: true })).toBeVisible();
  await adminContext.close();
});
