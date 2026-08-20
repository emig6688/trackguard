import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permisos";

const ITEMS = [
  "Luces delanteras",
  "Luces traseras y de freno",
  "Frenos",
  "Freno de mano",
  "Estado de neumáticos",
  "Presión de neumáticos",
  "Nivel de aceite",
  "Nivel de agua/refrigerante",
  "Documentación a bordo",
];

/**
 * Ruta temporal de un solo uso — crea el checklist pre-salida estándar para
 * la empresa del admin que llama, si todavía no tiene uno. Se borra después
 * de usarse (no existe una pantalla en la app para hacer esto todavía).
 */
export async function POST() {
  const { user, prisma } = await requireRole(["ADMIN"]);
  const empresaId = user.empresaId!;

  const existente = await prisma.checklistTemplate.findFirst({ where: { activo: true } });
  if (existente) {
    return NextResponse.json({ yaExistia: true, templateId: existente.id });
  }

  const template = await prisma.checklistTemplate.create({
    data: {
      empresaId,
      nombre: "Checklist pre-salida",
      activo: true,
      version: 1,
      items: {
        create: ITEMS.map((texto, i) => ({ orden: i + 1, texto })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json({ yaExistia: false, templateId: template.id, items: template.items.length });
}
