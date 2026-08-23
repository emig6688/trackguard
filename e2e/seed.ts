// Fixtures de datos para los tests end-to-end (Playwright). Corre contra la
// base LOCAL de desarrollo (ver DATABASE_URL en .env — nunca contra
// producción) y arma una empresa propia, aislada por empresaId, para no
// pisar ni depender de los datos reales que haya cargados en esa base.
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export const E2E_PASSWORD = "e2e-test-pass-1234";

export type FixtureE2E = {
  empresaId: string;
  vehiculoId: string;
  vehiculoPatente: string;
  admin: { email: string; password: string };
  mecanico: { email: string; nombre: string; password: string };
  chofer: { email: string; password: string };
  checklistItemTexto: string;
};

export async function seedE2E(): Promise<FixtureE2E> {
  const sufijo = Date.now().toString(36);
  const empresaId = `e2e-empresa-${sufijo}`;
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  const empresa = await prisma.empresa.create({
    data: { id: empresaId, nombre: `E2E Test ${sufijo}` },
  });

  const admin = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      email: `e2e-admin-${sufijo}@test.local`,
      passwordHash,
      nombre: "E2E Admin",
      rol: "ADMIN",
    },
  });

  const mecanico = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      email: `e2e-mecanico-${sufijo}@test.local`,
      passwordHash,
      nombre: "E2E Mecanico",
      rol: "MECANICO_INTERNO",
    },
  });

  const chofer = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      email: `e2e-chofer-${sufijo}@test.local`,
      passwordHash,
      nombre: "E2E Chofer",
      rol: "CHOFER",
    },
  });

  const patente = `E2E${sufijo.slice(-4).toUpperCase()}`;
  const vehiculo = await prisma.vehiculo.create({
    data: {
      empresaId: empresa.id,
      patente,
      marca: "Test",
      modelo: "Test",
      tipo: "CAMION",
    },
  });

  const checklistItemTexto = "Frenos en buen estado";
  await prisma.checklistTemplate.create({
    data: {
      empresaId: empresa.id,
      nombre: "Checklist E2E",
      activo: true,
      items: {
        create: [{ orden: 1, texto: checklistItemTexto, categoria: "FRENOS" }],
      },
    },
  });

  return {
    empresaId: empresa.id,
    vehiculoId: vehiculo.id,
    vehiculoPatente: patente,
    admin: { email: admin.email, password: E2E_PASSWORD },
    mecanico: { email: mecanico.email, nombre: mecanico.nombre, password: E2E_PASSWORD },
    chofer: { email: chofer.email, password: E2E_PASSWORD },
    checklistItemTexto,
  };
}

/**
 * Borra todo lo que seedE2E() creó, en el orden que respeta las foreign
 * keys (hijos antes que padres) — nada de esto tiene onDelete: Cascade
 * desde Empresa, así que hay que hacerlo a mano.
 */
export async function teardownE2E(empresaId: string) {
  const ordenes = await prisma.ordenDeTrabajo.findMany({ where: { empresaId }, select: { id: true } });
  const otIds = ordenes.map((o) => o.id);
  if (otIds.length > 0) {
    await prisma.oTHistorialEstado.deleteMany({ where: { ordenDeTrabajoId: { in: otIds } } });
    await prisma.ordenDeTrabajo.deleteMany({ where: { id: { in: otIds } } });
  }

  const checklists = await prisma.checklistRealizado.findMany({
    where: { vehiculo: { empresaId } },
    select: { id: true },
  });
  const checklistIds = checklists.map((c) => c.id);
  if (checklistIds.length > 0) {
    await prisma.checklistRespuesta.deleteMany({ where: { checklistRealizadoId: { in: checklistIds } } });
    await prisma.checklistRealizado.deleteMany({ where: { id: { in: checklistIds } } });
  }

  const templates = await prisma.checklistTemplate.findMany({ where: { empresaId }, select: { id: true } });
  const templateIds = templates.map((t) => t.id);
  if (templateIds.length > 0) {
    await prisma.checklistItem.deleteMany({ where: { templateId: { in: templateIds } } });
    await prisma.checklistTemplate.deleteMany({ where: { id: { in: templateIds } } });
  }

  await prisma.notificacion.deleteMany({ where: { empresaId } });
  await prisma.vehiculo.deleteMany({ where: { empresaId } });
  await prisma.usuario.deleteMany({ where: { empresaId } });
  await prisma.empresa.delete({ where: { id: empresaId } });
}

export async function disconnectE2E() {
  await prisma.$disconnect();
}
