import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarWhatsapp } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";
import { diasHastaVencimiento } from "@/lib/vencimientos";
import type { CanalNotificacion, TipoNotificacion } from "@/app/generated/prisma/client";

// El cron corre sobre todas las empresas con el cliente crudo (no hay sesión
// de la que colgar el cliente scoped), así que acá se consulta la regla
// directo en vez de reusar lib/notificaciones.ts — su firma está pensada para
// el cliente con alcance de una request, no para este caso cross-tenant.
async function reglaConfigurada(empresaId: string, tipo: TipoNotificacion) {
  const regla = await prisma.reglaNotificacion.findUnique({ where: { empresaId_tipo: { empresaId, tipo } } });
  if (!regla || !regla.activo) return { roles: [], canales: [] as CanalNotificacion[], diasAviso: [] as number[] };
  return { roles: regla.roles, canales: regla.canales, diasAviso: regla.diasAviso };
}

async function resolverDestinatarios(doc: { empresaId: string; entidadTipo: string; entidadId: string }) {
  if (doc.entidadTipo === "CHOFER") {
    const regla = await reglaConfigurada(doc.empresaId, "VENCIMIENTO_DOCUMENTO_CHOFER");
    const [chofer, responsables] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: doc.entidadId } }),
      regla.roles.length > 0
        ? prisma.usuario.findMany({
            where: { empresaId: doc.empresaId, rol: { in: regla.roles }, activo: true, eliminadoEn: null },
          })
        : Promise.resolve([]),
    ]);
    const destinatarios = [chofer, ...responsables].filter((u): u is NonNullable<typeof u> => u != null);
    return {
      tipo: "VENCIMIENTO_DOCUMENTO_CHOFER" as const,
      entidadLabel: chofer?.nombre ?? "el chofer",
      destinatarios,
      diasAviso: regla.diasAviso,
      canales: regla.canales,
    };
  }

  const regla = await reglaConfigurada(doc.empresaId, "VENCIMIENTO_DOCUMENTO_VEHICULO");
  const [vehiculo, responsables] = await Promise.all([
    prisma.vehiculo.findUnique({ where: { id: doc.entidadId } }),
    regla.roles.length > 0
      ? prisma.usuario.findMany({
          where: { empresaId: doc.empresaId, rol: { in: regla.roles }, activo: true, eliminadoEn: null },
        })
      : Promise.resolve([]),
  ]);
  return {
    tipo: "VENCIMIENTO_DOCUMENTO_VEHICULO" as const,
    entidadLabel: vehiculo?.patente ?? "el vehículo",
    destinatarios: responsables,
    diasAviso: regla.diasAviso,
    canales: regla.canales,
  };
}

/**
 * Corre una vez al día (ver vercel.json). Avisa cuando a un documento le
 * quedan exactamente los días configurados en ReglaNotificacion.diasAviso
 * para vencer — cada umbral se manda una sola vez por documento
 * (Documento.diasAvisoNotificados) para no repetir el mismo aviso en
 * corridas siguientes del mismo día.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const documentos = await prisma.documento.findMany({
    where: { activo: true, eliminadoEn: null },
    include: { tipoDocumento: true },
  });

  const notificados: string[] = [];
  const errores: string[] = [];

  for (const doc of documentos) {
    try {
      const diasRestantes = diasHastaVencimiento(doc.fechaVencimiento);
      const { tipo, entidadLabel, destinatarios, diasAviso, canales } = await resolverDestinatarios(doc);

      const umbral = diasAviso.find((d) => d === diasRestantes && !doc.diasAvisoNotificados.includes(d));
      if (umbral === undefined) continue;

      const asunto = `Aviso de vencimiento: ${doc.tipoDocumento.nombre}`;
      const mensaje =
        `Aviso de vencimiento: ${doc.tipoDocumento.nombre} de ${entidadLabel} vence en ${diasRestantes} ` +
        `días (${doc.fechaVencimiento.toLocaleDateString("es-AR")}).`;

      const envios = destinatarios.flatMap((u) => [
        ...(canales.includes("WHATSAPP")
          ? [enviarWhatsapp(u.telefono, mensaje).then((resultado) => ({ canal: "WHATSAPP" as const, destinatario: u.telefono, resultado }))]
          : []),
        ...(canales.includes("EMAIL")
          ? [enviarEmail(u.email, asunto, mensaje).then((resultado) => ({ canal: "EMAIL" as const, destinatario: u.email, resultado }))]
          : []),
      ]);
      const [resultadosEnvio] = await Promise.all([
        Promise.all(envios),
        ...(canales.includes("EN_APP") && destinatarios.length > 0
          ? [
              prisma.notificacion.createMany({
                data: destinatarios.map((u) => ({
                  empresaId: doc.empresaId,
                  usuarioId: u.id,
                  tipo,
                  titulo: asunto,
                  mensaje,
                  href: "/documentos",
                })),
              }),
            ]
          : []),
      ]);
      const fallos = resultadosEnvio.filter((r) => !r.resultado.enviado);
      if (fallos.length > 0) {
        await prisma.notificacionFallo.createMany({
          data: fallos.map((f) => ({
            empresaId: doc.empresaId,
            tipo,
            canal: f.canal,
            destinatario: f.destinatario?.trim() || "(sin dato)",
            motivo: f.resultado.enviado ? "" : f.resultado.motivo,
          })),
        });
      }

      await prisma.documento.update({
        where: { id: doc.id },
        data: { diasAvisoNotificados: { push: umbral } },
      });

      notificados.push(doc.id);
    } catch (error) {
      console.error(`[cron/vencimientos-documentacion] documento=${doc.id}`, error);
      errores.push(doc.id);
    }
  }

  return NextResponse.json({ notificados, errores });
}
