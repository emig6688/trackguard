import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Empresa de demo/desarrollo: en una base ya migrada a multi-tenant esto
  // no se corre contra producción (esa empresa ya existe desde el backfill
  // de la migración) — este seed es para levantar una base nueva desde cero.
  const empresa = await prisma.empresa.upsert({
    where: { id: "empresa-demo" },
    update: {},
    create: {
      id: "empresa-demo",
      nombre: "Empresa Demo",
    },
  });

  const adminPasswordHash = await bcrypt.hash("admin1234", 10);
  await prisma.usuario.upsert({
    where: { email: "admin@frigorifico.local" },
    update: {},
    create: {
      empresaId: empresa.id,
      email: "admin@frigorifico.local",
      passwordHash: adminPasswordHash,
      nombre: "Administrador",
      rol: "ADMIN",
    },
  });

  const tiposDocumento: {
    codigo: string;
    nombre: string;
    aplicaA: "VEHICULO" | "CHOFER" | "AMBOS";
  }[] = [
    { codigo: "VTV", nombre: "VTV / RTO", aplicaA: "VEHICULO" },
    { codigo: "SEGURO", nombre: "Seguro", aplicaA: "VEHICULO" },
    { codigo: "HABILITACION_BROMATOLOGICA", nombre: "Habilitación bromatológica", aplicaA: "VEHICULO" },
    { codigo: "SENASA_VEHICULO", nombre: "Habilitación SENASA (vehículo)", aplicaA: "VEHICULO" },
    { codigo: "LICENCIA_TRANSITO", nombre: "Licencia de tránsito", aplicaA: "VEHICULO" },
    { codigo: "LICENCIA_CONDUCIR", nombre: "Licencia de conducir", aplicaA: "CHOFER" },
    { codigo: "LIBRETA_SANITARIA", nombre: "Libreta sanitaria", aplicaA: "CHOFER" },
    { codigo: "SENASA_CHOFER", nombre: "Habilitación SENASA (chofer)", aplicaA: "CHOFER" },
  ];

  for (const tipo of tiposDocumento) {
    await prisma.tipoDocumentoConfig.upsert({
      where: { empresaId_codigo: { empresaId: empresa.id, codigo: tipo.codigo } },
      update: {},
      create: { ...tipo, empresaId: empresa.id },
    });
  }

  const template = await prisma.checklistTemplate.upsert({
    where: { id: "checklist-pretrip-default" },
    update: {},
    create: {
      id: "checklist-pretrip-default",
      empresaId: empresa.id,
      nombre: "Pre-trip camión",
      activo: true,
    },
  });

  const items: { orden: number; texto: string; categoria: "LUCES" | "FRENOS" | "NEUMATICOS" | "FLUIDOS" | "DOCUMENTACION" | "OTRO" }[] = [
    { orden: 1, texto: "Luces delanteras", categoria: "LUCES" },
    { orden: 2, texto: "Luces traseras y de freno", categoria: "LUCES" },
    { orden: 3, texto: "Frenos", categoria: "FRENOS" },
    { orden: 4, texto: "Freno de mano", categoria: "FRENOS" },
    { orden: 5, texto: "Estado de neumáticos", categoria: "NEUMATICOS" },
    { orden: 6, texto: "Presión de neumáticos", categoria: "NEUMATICOS" },
    { orden: 7, texto: "Nivel de aceite", categoria: "FLUIDOS" },
    { orden: 8, texto: "Nivel de agua/refrigerante", categoria: "FLUIDOS" },
    { orden: 9, texto: "Documentación a bordo", categoria: "DOCUMENTACION" },
  ];

  for (const item of items) {
    const existente = await prisma.checklistItem.findFirst({
      where: { templateId: template.id, orden: item.orden },
    });
    if (!existente) {
      await prisma.checklistItem.create({
        data: { ...item, templateId: template.id },
      });
    }
  }

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
