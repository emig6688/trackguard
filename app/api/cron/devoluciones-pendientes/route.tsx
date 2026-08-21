import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { enviarWhatsapp } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";
import { inicioDeHoy } from "@/lib/checklist";
import { ReporteGuardiaDiarioDocument } from "@/lib/pdf/reporte-guardia-diario";

export const maxDuration = 60;

// Función aparte (en vez de armar el JSX inline dentro del try/catch del
// loop de abajo) porque el linter de hooks marca error cualquier JSX
// construido léxicamente dentro de un try/catch.
function documentoResumen(props: React.ComponentProps<typeof ReporteGuardiaDiarioDocument>) {
  return <ReporteGuardiaDiarioDocument {...props} />;
}

/**
 * Corre una vez al día (ver vercel.json — el plan Hobby de Vercel no permite
 * crons horarios, solo diarios). Por eso NO se compara horaEnvio contra la
 * hora actual: cualquier empresa con la regla DEVOLUCION_SIN_ENVIAR activa y
 * una hora configurada (el campo sigue sirviendo como "encendido/apagado" de
 * este aviso) recibe el resumen en esta única corrida diaria, protegido por
 * idempotencia de "una vez por día" más abajo.
 *
 * Antes este cron solo avisaba si había devoluciones sin que el guardia las
 * "enviara" a mano. Ahora el guardia ya no envía nada manualmente — este
 * cron arma y manda un PDF con el resumen del día (vehículos sin checklist
 * pre-salida, sin cierre de ruta, con el tanque sin llenar, y las
 * devoluciones registradas) a quien esté configurado en /notificaciones,
 * corra o no haya novedades.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ahora = new Date();
  const inicioDelDia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  const hoy = inicioDeHoy();

  const reglas = await prisma.reglaNotificacion.findMany({
    where: { tipo: "DEVOLUCION_SIN_ENVIAR", activo: true },
  });

  const enviados: string[] = [];
  const errores: string[] = [];

  for (const regla of reglas) {
    try {
      if (regla.horaEnvio == null) continue;
      if (regla.roles.length === 0 || regla.canales.length === 0) continue;

      const destinatarios = await prisma.usuario.findMany({
        where: { empresaId: regla.empresaId, rol: { in: regla.roles }, activo: true, eliminadoEn: null },
      });
      if (destinatarios.length === 0) continue;

      // Idempotencia: reclama el día antes de mandar. Si otra invocación
      // (reintento de Vercel) ya lo reclamó, count da 0 y no se duplica el
      // envío.
      const claim = await prisma.reglaNotificacion.updateMany({
        where: { id: regla.id, OR: [{ ultimoEnvioEn: null }, { ultimoEnvioEn: { lt: inicioDelDia } }] },
        data: { ultimoEnvioEn: ahora },
      });
      if (claim.count === 0) continue;

      const vehiculos = await prisma.vehiculo.findMany({
        where: { empresaId: regla.empresaId, activo: true, eliminadoEn: null },
        select: { id: true, patente: true },
        orderBy: { patente: "asc" },
      });
      const vehiculoIds = vehiculos.map((v) => v.id);

      // ChecklistRealizado no tiene empresaId propio (se escopea vía
      // vehiculoId/choferId) — filtra por los vehículos ya traídos arriba.
      const [checklists, eventos, diasNoOperados, devoluciones] = await Promise.all([
        prisma.checklistRealizado.findMany({
          where: { vehiculoId: { in: vehiculoIds }, momento: "PRESALIDA", fechaHora: { gte: hoy } },
          select: { vehiculoId: true },
        }),
        prisma.eventoRuta.findMany({
          where: { empresaId: regla.empresaId, fechaHora: { gte: hoy } },
          select: { vehiculoId: true, tanqueLleno: true },
        }),
        prisma.diaNoOperado.findMany({
          where: { empresaId: regla.empresaId, fecha: hoy },
          select: { vehiculoId: true },
        }),
        prisma.devolucion.findMany({
          where: { empresaId: regla.empresaId, fecha: hoy },
          include: { chofer: { select: { nombre: true } } },
        }),
      ]);

      const vehiculosConPresalida = new Set(checklists.map((c) => c.vehiculoId));
      const vehiculosConCierre = new Set(eventos.map((e) => e.vehiculoId));
      const vehiculosNoOperados = new Set(diasNoOperados.map((d) => d.vehiculoId));
      const tanqueLlenoPorVehiculo = new Map<string, boolean | null>();
      for (const e of eventos) {
        if (!tanqueLlenoPorVehiculo.has(e.vehiculoId)) tanqueLlenoPorVehiculo.set(e.vehiculoId, e.tanqueLleno);
      }

      const vehiculosActivos = vehiculos.filter((v) => !vehiculosNoOperados.has(v.id));
      const vehiculosSinPresalida = vehiculosActivos
        .filter((v) => !vehiculosConPresalida.has(v.id))
        .map((v) => v.patente);
      const vehiculosSinCierre = vehiculosActivos
        .filter((v) => !vehiculosConCierre.has(v.id))
        .map((v) => v.patente);
      const vehiculosTanqueNoLleno = vehiculos
        .filter((v) => tanqueLlenoPorVehiculo.get(v.id) === false || tanqueLlenoPorVehiculo.get(v.id) === null)
        .filter((v) => vehiculosConCierre.has(v.id))
        .map((v) => v.patente);

      const pdfBuffer = await renderToBuffer(
        documentoResumen({
          fecha: hoy,
          vehiculosSinPresalida,
          vehiculosSinCierre,
          vehiculosTanqueNoLleno,
          devoluciones: devoluciones.map((d) => ({ chofer: d.chofer.nombre, cliente: d.cliente, remito: d.remito })),
        })
      );

      const asunto = "Resumen diario de guardia";
      const mensaje = `Resumen de hoy: ${vehiculosSinPresalida.length} vehículo(s) sin checklist pre-salida, ${vehiculosSinCierre.length} sin cierre de ruta, ${vehiculosTanqueNoLleno.length} con el tanque sin llenar, ${devoluciones.length} devolución(es) registrada(s).`;
      const nombreArchivo = `resumen-guardia-${hoy.toISOString().slice(0, 10)}.pdf`;

      const envios = destinatarios.flatMap((u) => [
        ...(regla.canales.includes("WHATSAPP")
          ? [enviarWhatsapp(u.telefono, mensaje).then((resultado) => ({ canal: "WHATSAPP" as const, destinatario: u.telefono, resultado }))]
          : []),
        ...(regla.canales.includes("EMAIL")
          ? [
              enviarEmail(u.email, asunto, mensaje, { nombreArchivo, contenido: pdfBuffer }).then((resultado) => ({
                canal: "EMAIL" as const,
                destinatario: u.email,
                resultado,
              })),
            ]
          : []),
      ]);
      const [resultadosEnvio] = await Promise.all([
        Promise.all(envios),
        ...(regla.canales.includes("EN_APP")
          ? [
              prisma.notificacion.createMany({
                data: destinatarios.map((u) => ({
                  empresaId: regla.empresaId,
                  usuarioId: u.id,
                  tipo: "DEVOLUCION_SIN_ENVIAR" as const,
                  titulo: asunto,
                  mensaje,
                  href: "/dashboard",
                })),
              }),
            ]
          : []),
      ]);
      const fallos = resultadosEnvio.filter((r) => !r.resultado.enviado);
      if (fallos.length > 0) {
        await prisma.notificacionFallo.createMany({
          data: fallos.map((f) => ({
            empresaId: regla.empresaId,
            tipo: "DEVOLUCION_SIN_ENVIAR" as const,
            canal: f.canal,
            destinatario: f.destinatario?.trim() || "(sin dato)",
            motivo: f.resultado.enviado ? "" : (f.resultado.detalle ?? f.resultado.motivo),
          })),
        });
      }

      enviados.push(regla.empresaId);
    } catch (error) {
      console.error(`[cron/devoluciones-pendientes] empresa=${regla.empresaId}`, error);
      errores.push(regla.empresaId);
    }
  }

  return NextResponse.json({ enviados, errores });
}
