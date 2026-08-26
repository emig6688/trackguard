import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { leerTicketCombustibleAction } from "@/app/_actions/ocrTicketCombustible";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

// leerTicketCombustible (lib/ocr-ticket-combustible.ts) llama a la API REST de
// OpenAI vía fetch global cuando OPENAI_API_KEY está seteada. En este entorno
// de test no debe haber ninguna llamada de red real bajo ninguna
// circunstancia: si la variable llegara a estar seteada en el .env local, se
// stubea fetch acá mismo (solo en este archivo) para que la acción tome el
// camino "proveedor_no_configurado"/mockeado en vez de pegarle a
// api.openai.com. Se restaura en afterAll.
const teniaApiKey = "OPENAI_API_KEY" in process.env && !!process.env.OPENAI_API_KEY;
if (teniaApiKey) {
  delete process.env.OPENAI_API_KEY;
}

describe("app/_actions/ocrTicketCombustible.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let chofer: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("ocrticket");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;
    chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
    void prisma; // no se usa para datos propios de este módulo, solo para el fixture de empresa
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  it("sin OPENAI_API_KEY configurada, devuelve proveedor_no_configurado sin llamar a la red", async () => {
    expect(process.env.OPENAI_API_KEY).toBeFalsy();
    const fetchEspiado = vi.spyOn(globalThis, "fetch");

    mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
    const fd = new FormData();
    fd.set("archivoTicket", new File(["contenido"], "ticket.jpg", { type: "image/jpeg" }));
    const resultado = await leerTicketCombustibleAction(fd);

    expect(resultado).toEqual({ leido: false, motivo: "proveedor_no_configurado" });
    expect(fetchEspiado).not.toHaveBeenCalled();
    fetchEspiado.mockRestore();
  });

  it("rechaza si no se manda ningún archivo", async () => {
    mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
    const resultado = await leerTicketCombustibleAction(new FormData());
    expect(resultado).toEqual({ leido: false, motivo: "archivo_invalido" });
  });

  it("rechaza un archivo vacío (size 0)", async () => {
    mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
    const fd = new FormData();
    fd.set("archivoTicket", new File([], "vacio.jpg", { type: "image/jpeg" }));
    const resultado = await leerTicketCombustibleAction(fd);
    expect(resultado).toEqual({ leido: false, motivo: "archivo_invalido" });
  });

  it("un rol fuera de ROLES_MOBILE_CHOFER no puede usar el OCR", async () => {
    const admin = await crearUsuarioDePrueba(empresaId, "ADMIN");
    mockearSesion({ id: admin.id, rol: "ADMIN", empresaId });
    const fd = new FormData();
    fd.set("archivoTicket", new File(["contenido"], "ticket.jpg", { type: "image/jpeg" }));
    await expect(leerTicketCombustibleAction(fd)).rejects.toThrow(AutorizacionError);
  });
});
