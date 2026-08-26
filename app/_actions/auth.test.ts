import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// vitest.setup.ts mockea "@/auth" globalmente pero solo expone `auth`
// (vi.fn()) — este archivo de test necesita además signIn/signOut, así que
// se sobreescribe el mock acá mismo (solo para este archivo: vi.mock se
// hoistea al tope de CADA archivo de test, así que este factory gana sobre
// el de vitest.setup.ts dentro de este módulo). loginAction/logoutAction
// (app/_actions/auth.ts) son solo el "pegamento" alrededor de signIn/signOut
// de NextAuth — la lógica de autenticación real (rate limit, bcrypt, etc.)
// vive en next-auth/authorize (auth.ts de la raíz) y queda fuera de esta
// suite a propósito.
//
// El paquete "next-auth" en sí no se puede importar de verdad en este
// entorno de test: su próprio next-auth/lib/env.js hace
// `import { NextRequest } from "next/server"` con un comentario propio
// ("Next.js does not yet correctly use the package.json#exports field") —
// con Next 16 esa resolución falla fuera de un build real de Next. Se
// mockea el paquete completo acá (solo para este archivo) con una clase
// AuthError liviana que cumple el mismo contrato (instanceof) que usa
// app/_actions/auth.ts.
vi.mock("next-auth", () => {
  class AuthError extends Error {}
  return { AuthError };
});

const signInMock = vi.fn();
const signOutMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: (...args: unknown[]) => signInMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

import { loginAction, logoutAction } from "@/app/_actions/auth";
import { AuthError as AuthErrorDePrueba } from "next-auth";
import { crearEmpresaDePrueba, crearUsuarioDePrueba, borrarEmpresaDePrueba } from "@/lib/test-fixtures";
import { RedirectDeTest } from "../../vitest.setup";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function formData(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("app/_actions/auth.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("auth");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    void prisma;
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  describe("loginAction", () => {
    it("con signIn exitoso, redirige a la home del rol del usuario (ADMIN -> /dashboard)", async () => {
      const admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
      signInMock.mockResolvedValueOnce(undefined);

      let capturado: RedirectDeTest | undefined;
      try {
        await loginAction(undefined, formData({ usuario: admin.email, password: "test-vitest-1234" }));
      } catch (err) {
        if (!(err instanceof RedirectDeTest)) throw err;
        capturado = err;
      }
      expect(capturado?.url).toBe("/dashboard");
      expect(signInMock).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ usuario: admin.email, redirect: false })
      );
    });

    it("con signIn exitoso, redirige a /mobile/inicio para un CHOFER", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      signInMock.mockResolvedValueOnce(undefined);

      let capturado: RedirectDeTest | undefined;
      try {
        await loginAction(undefined, formData({ usuario: chofer.email, password: "test-vitest-1234" }));
      } catch (err) {
        if (!(err instanceof RedirectDeTest)) throw err;
        capturado = err;
      }
      expect(capturado?.url).toBe("/mobile/inicio");
    });

    it("con signIn exitoso, redirige a /guardia para un GUARDIA", async () => {
      const guardia = await crearUsuarioDePrueba(empresaId, "GUARDIA");
      signInMock.mockResolvedValueOnce(undefined);

      let capturado: RedirectDeTest | undefined;
      try {
        await loginAction(undefined, formData({ usuario: guardia.email, password: "test-vitest-1234" }));
      } catch (err) {
        if (!(err instanceof RedirectDeTest)) throw err;
        capturado = err;
      }
      expect(capturado?.url).toBe("/guardia");
    });

    it("si signIn tira un AuthError, devuelve el mensaje de credenciales inválidas sin redirigir", async () => {
      signInMock.mockRejectedValueOnce(new AuthErrorDePrueba("CredentialsSignin"));
      const resultado = await loginAction(undefined, formData({ usuario: "no-existe@example.local", password: "x" }));
      expect(resultado?.error).toMatch(/incorrect/i);
    });

    it("si signIn tira un error que no es AuthError, lo repropaga", async () => {
      signInMock.mockRejectedValueOnce(new Error("boom"));
      await expect(
        loginAction(undefined, formData({ usuario: "cualquiera@example.local", password: "x" }))
      ).rejects.toThrow("boom");
    });
  });

  describe("logoutAction", () => {
    it("llama a signOut con redirectTo /login", async () => {
      signOutMock.mockResolvedValueOnce(undefined);
      await logoutAction();
      expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/login" });
    });
  });
});
