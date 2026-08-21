import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import { usuariosDeEmpresaPorRol } from "@/lib/permisos";
import { enviarWhatsapp } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";
import { enviarPush } from "@/lib/push";
import type { CanalNotificacion, Rol, TipoNotificacion } from "@/app/generated/prisma/client";

export type InfoTipoNotificacion = {
  label: string;
  disparador: string;
  destinatarioFijo: string | null;
  usaDiasAviso: boolean;
  // Muestra el selector de hora del día (además de los controles habituales
  // de roles/canales) para los tipos que se evalúan una vez al día a una
  // hora fija en vez de en el momento del evento.
  usaHoraEnvio?: boolean;
};

/**
 * Catálogo de todos los tipos de notificación que la app dispara hoy. Cada
 * empresa decide, desde el mantenedor de notificaciones, qué roles reciben
 * además del destinatario fijo (cuando lo hay), por qué canal, y —para los
 * tipos que usan un umbral de días— con cuánta anticipación.
 *
 * No todos los valores de TipoNotificacion tienen entrada acá — un tipo sin
 * entrada simplemente no aparece en /notificaciones ni se puede configurar
 * (así se "saca" una notificación sin tener que borrar el valor del enum de
 * la base, que requeriría una migración para recrear el tipo).
 */
export const CATALOGO_NOTIFICACIONES: Partial<Record<TipoNotificacion, InfoTipoNotificacion>> = {
  VENCIMIENTO_DOCUMENTO_CHOFER: {
    label: "Vencimiento de documento de chofer",
    disparador: "A los días configurados abajo antes de que venza un documento de un chofer (licencia, libreta sanitaria, etc.)",
    destinatarioFijo: "El chofer dueño del documento",
    usaDiasAviso: true,
  },
  VENCIMIENTO_DOCUMENTO_VEHICULO: {
    label: "Vencimiento de documento de vehículo",
    disparador: "A los días configurados abajo antes de que venza un documento de un vehículo (VTV, seguro, habilitación SENASA, etc.)",
    destinatarioFijo: null,
    usaDiasAviso: true,
  },
  NUEVA_ORDEN_COMPRA: {
    label: "Nueva orden de compra",
    disparador: "Al crearse una orden de compra, manual o automática por stock mínimo",
    destinatarioFijo: null,
    usaDiasAviso: false,
  },
  OT_COMPLETADA_CONFIRMACION: {
    label: "OT completada, pendiente de confirmación",
    disparador: "Cuando el mecánico completa una OT que se originó en una novedad de un chofer",
    destinatarioFijo: "El chofer que reportó la novedad",
    usaDiasAviso: false,
  },
  COMPRA_REALIZADA: {
    label: "Orden de compra realizada",
    disparador: "Cuando se marca una orden de compra como realizada (comprada)",
    destinatarioFijo: "Quien creó la orden de compra",
    usaDiasAviso: false,
  },
  OT_GENERADA_CHOFER: {
    label: "OT generada por el chofer",
    disparador: "Cuando un chofer genera una OT (evento de ruta con desperfecto o falla de checklist pre-salida)",
    destinatarioFijo: "El encargado de mantenimiento",
    usaDiasAviso: false,
  },
  CHECKLIST_NO_REALIZADO: {
    label: "Checklist obligatorio",
    disparador:
      "Si activás esto, el chofer no puede cargar combustible, reportar eventos de ruta ni cargar gastos hasta completar el checklist pre-salida del día. Cuando lo bloquea, se avisa a los roles que elijas.",
    destinatarioFijo: null,
    usaDiasAviso: false,
  },
  RESUMEN_VEHICULOS_OPERATIVOS: {
    label: "Resumen diario de vehículos operativos",
    disparador:
      "Una vez al día, un resumen de cuántos vehículos están operativos. Elegir una hora abajo activa este aviso — con el plan actual de Vercel (crons diarios, no horarios) se manda una vez al día a una hora fija del sistema, no necesariamente la que elijas.",
    destinatarioFijo: null,
    usaDiasAviso: false,
    usaHoraEnvio: true,
  },
  DEVOLUCION_SIN_ENVIAR: {
    label: "Resumen diario de guardia",
    disparador:
      "Una vez al día, un PDF con vehículos sin checklist pre-salida, sin cierre de ruta, con el tanque sin llenar, y las devoluciones registradas. Elegir una hora abajo activa este aviso — con el plan actual de Vercel (crons diarios, no horarios) se manda una vez al día a una hora fija del sistema, no necesariamente la que elijas. El PDF solo va por email; WhatsApp y la app reciben un resumen en texto.",
    destinatarioFijo: null,
    usaDiasAviso: false,
    usaHoraEnvio: true,
  },
  COMPRA_PENDIENTE_AUTORIZACION: {
    label: "Compra pendiente de autorización",
    disparador: "Cuando se carga una orden de compra que supera el monto configurado en la tarjeta de autorización de compras.",
    destinatarioFijo: "El gerente",
    usaDiasAviso: false,
  },
  PRESUPUESTO_SUBIDO: {
    label: "Presupuesto subido a una compra",
    disparador: "Cuando el encargado de compras sube un presupuesto a una orden pendiente de autorización.",
    destinatarioFijo: "El gerente",
    usaDiasAviso: false,
  },
  COMPRA_AUTORIZADA: {
    label: "Compra autorizada por gerencia",
    disparador: "Cuando el gerente aprueba (elige un presupuesto o autoriza directo) una orden de compra pendiente.",
    destinatarioFijo: "El administrador y el encargado de compras",
    usaDiasAviso: false,
  },
};

export type ReglaNotificacionInfo = {
  roles: Rol[];
  canales: CanalNotificacion[];
  diasAviso: number[];
  activo: boolean;
};

const REGLA_VACIA: ReglaNotificacionInfo = { roles: [], canales: [], diasAviso: [], activo: false };

/**
 * Config completa (roles adicionales, canales, días de aviso) que la empresa
 * definió para un tipo de notificación. Devuelve una regla "vacía/inactiva"
 * si todavía no se cargó ninguna — nunca dispara nada en ese caso.
 */
export async function obtenerReglaNotificacion(
  prisma: ScopedPrismaClient,
  empresaId: string,
  tipo: TipoNotificacion
): Promise<ReglaNotificacionInfo> {
  const regla = await prisma.reglaNotificacion.findUnique({
    where: { empresaId_tipo: { empresaId, tipo } },
  });
  if (!regla || !regla.activo) return REGLA_VACIA;
  return { roles: regla.roles, canales: regla.canales, diasAviso: regla.diasAviso, activo: regla.activo };
}

/**
 * Manda el mismo mensaje a una lista de destinatarios por cada canal
 * configurado en la regla (WhatsApp, email y/o en la app). Best-effort: un
 * destinatario sin teléfono/email simplemente no recibe nada por esa vía. El
 * canal EN_APP crea una fila Notificacion por destinatario en vez de llamar a
 * un proveedor externo — la muestra el campanita de la app (ver
 * components/notificaciones/notification-bell.tsx).
 */
export async function enviarPorCanalesConfigurados(
  prisma: ScopedPrismaClient,
  empresaId: string,
  destinatarios: { id: string; telefono: string | null; email: string }[],
  canales: CanalNotificacion[],
  tipo: TipoNotificacion,
  asuntoEmail: string,
  mensaje: string,
  href?: string
) {
  const envios = destinatarios.flatMap((u) => [
    ...(canales.includes("WHATSAPP")
      ? [enviarWhatsapp(u.telefono, mensaje).then((resultado) => ({ canal: "WHATSAPP" as const, destinatario: u.telefono, resultado }))]
      : []),
    ...(canales.includes("EMAIL")
      ? [enviarEmail(u.email, asuntoEmail, mensaje).then((resultado) => ({ canal: "EMAIL" as const, destinatario: u.email, resultado }))]
      : []),
  ]);

  const [resultadosEnvio] = await Promise.all([
    Promise.all(envios),
    ...(canales.includes("EN_APP") && destinatarios.length > 0
      ? [
          prisma.notificacion.createMany({
            data: destinatarios.map((u) => ({
              empresaId,
              usuarioId: u.id,
              tipo,
              titulo: asuntoEmail,
              mensaje,
              href,
            })),
          }),
          // El push va 1:1 con "En la app": mismos destinatarios, sin canal
          // ni configuración aparte — es solo la versión que llega aunque el
          // usuario tenga la app cerrada (ver lib/push.ts).
          ...destinatarios.map((u) =>
            enviarPush(prisma, u.id, { title: asuntoEmail, body: mensaje, url: href })
          ),
        ]
      : []),
  ]);

  // enviarWhatsapp/enviarEmail son best-effort y nunca tiran excepción — sin
  // esto, un fallo (sin proveedor configurado, sin teléfono/email, error del
  // proveedor) quedaba solo en el log del servidor y nadie se enteraba.
  const fallos: { canal: CanalNotificacion; destinatario: string; motivo: string }[] = [];
  for (const envio of resultadosEnvio) {
    if (!envio.resultado.enviado) {
      fallos.push({
        canal: envio.canal,
        destinatario: envio.destinatario?.trim() || "(sin dato)",
        motivo: envio.resultado.detalle ?? envio.resultado.motivo,
      });
    }
  }
  if (fallos.length > 0) {
    await prisma.notificacionFallo.createMany({
      data: fallos.map((f) => ({ empresaId, tipo, ...f })),
    });
  }
}

/**
 * Avisa siempre (email + en la app, sin depender de la regla) a todo
 * encargado de mantenimiento activo cuando un chofer genera una OT (evento
 * de ruta o falla de checklist) — necesitan enterarse para aprobarla, no es
 * opcional. Los roles extra que se configuren en /notificaciones reciben
 * además por los canales que elijan.
 *
 * `reiterada: true` es para cuando el chofer vuelve a reportar el mismo
 * problema (mismo vehículo, misma área) mientras la OT anterior sigue
 * abierta — no se crea una OT nueva (ver buscarOTAbiertaMismaArea en
 * lib/ot.ts), pero igual hay que avisar que sigue sin resolverse.
 */
export async function notificarOTGeneradaChofer(
  prisma: ScopedPrismaClient,
  empresaId: string,
  ot: { id: string; numero: string; titulo: string; patente: string; reiterada?: boolean }
) {
  const mensaje = ot.reiterada
    ? `El chofer volvió a reportar el mismo problema en la OT ${ot.numero} (${ot.patente}): ${ot.titulo}. Sigue sin resolverse.`
    : `El chofer generó una nueva OT ${ot.numero} para ${ot.patente}: ${ot.titulo}`;
  const asunto = ot.reiterada ? `OT sin resolver, reiterada: ${ot.numero}` : `Nueva OT de chofer: ${ot.numero}`;
  const href = `/ordenes-trabajo/${ot.id}`;

  const encargados = await usuariosDeEmpresaPorRol(prisma, empresaId, ["ENCARGADO_MANTENIMIENTO"]);
  await enviarPorCanalesConfigurados(
    prisma,
    empresaId,
    encargados,
    ["EMAIL", "EN_APP"],
    "OT_GENERADA_CHOFER",
    asunto,
    mensaje,
    href
  );

  const regla = await obtenerReglaNotificacion(prisma, empresaId, "OT_GENERADA_CHOFER");
  const rolesExtra = regla.roles.filter((r) => r !== "ENCARGADO_MANTENIMIENTO");
  if (rolesExtra.length > 0 && regla.canales.length > 0) {
    const destinatariosExtra = await usuariosDeEmpresaPorRol(prisma, empresaId, rolesExtra);
    await enviarPorCanalesConfigurados(
      prisma,
      empresaId,
      destinatariosExtra,
      regla.canales,
      "OT_GENERADA_CHOFER",
      asunto,
      mensaje,
      href
    );
  }
}

/**
 * Avisa siempre (email + en la app, sin depender de la regla) a todo GERENTE
 * activo cuando se carga una OC que supera el monto de autorización
 * configurado — necesita enterarse para poder aprobarla, no es opcional. Los
 * roles extra que se configuren en /notificaciones reciben además por los
 * canales que elijan.
 */
export async function notificarCompraPendienteAutorizacion(
  prisma: ScopedPrismaClient,
  empresaId: string,
  compra: { id: string; numero: string; montoEstimado: string | null }
) {
  const mensaje = `La orden de compra ${compra.numero}${
    compra.montoEstimado ? ` (estimada en $${compra.montoEstimado})` : ""
  } quedó pendiente de tu autorización.`;
  const asunto = `Compra pendiente de autorización: ${compra.numero}`;
  const href = "/autorizaciones";

  const gerentes = await usuariosDeEmpresaPorRol(prisma, empresaId, ["GERENTE"]);
  await enviarPorCanalesConfigurados(
    prisma,
    empresaId,
    gerentes,
    ["EMAIL", "EN_APP"],
    "COMPRA_PENDIENTE_AUTORIZACION",
    asunto,
    mensaje,
    href
  );

  const regla = await obtenerReglaNotificacion(prisma, empresaId, "COMPRA_PENDIENTE_AUTORIZACION");
  const rolesExtra = regla.roles.filter((r) => r !== "GERENTE");
  if (rolesExtra.length > 0 && regla.canales.length > 0) {
    const destinatariosExtra = await usuariosDeEmpresaPorRol(prisma, empresaId, rolesExtra);
    await enviarPorCanalesConfigurados(
      prisma,
      empresaId,
      destinatariosExtra,
      regla.canales,
      "COMPRA_PENDIENTE_AUTORIZACION",
      asunto,
      mensaje,
      href
    );
  }
}

/**
 * Avisa siempre (email + en la app) a todo GERENTE activo cuando el
 * encargado de compras sube un presupuesto a una OC pendiente de
 * autorización — así sabe que ya puede elegir cuál aprobar.
 */
export async function notificarPresupuestoSubido(
  prisma: ScopedPrismaClient,
  empresaId: string,
  compra: { id: string; numero: string }
) {
  const mensaje = `Se subió un presupuesto a la orden de compra ${compra.numero}, pendiente de tu autorización.`;
  const asunto = `Presupuesto subido: ${compra.numero}`;
  const href = "/autorizaciones";

  const gerentes = await usuariosDeEmpresaPorRol(prisma, empresaId, ["GERENTE"]);
  await enviarPorCanalesConfigurados(
    prisma,
    empresaId,
    gerentes,
    ["EMAIL", "EN_APP"],
    "PRESUPUESTO_SUBIDO",
    asunto,
    mensaje,
    href
  );

  const regla = await obtenerReglaNotificacion(prisma, empresaId, "PRESUPUESTO_SUBIDO");
  const rolesExtra = regla.roles.filter((r) => r !== "GERENTE");
  if (rolesExtra.length > 0 && regla.canales.length > 0) {
    const destinatariosExtra = await usuariosDeEmpresaPorRol(prisma, empresaId, rolesExtra);
    await enviarPorCanalesConfigurados(
      prisma,
      empresaId,
      destinatariosExtra,
      regla.canales,
      "PRESUPUESTO_SUBIDO",
      asunto,
      mensaje,
      href
    );
  }
}

const ROLES_FIJOS_COMPRA_AUTORIZADA: Rol[] = ["ADMIN", "ENCARGADO_COMPRAS"];

/**
 * Avisa siempre (email + en la app, sin depender de la regla) a ADMIN y
 * ENCARGADO_COMPRAS cuando el gerente aprueba una OC que estaba pendiente de
 * autorización — así saben que ya la pueden comprar. Los roles extra que se
 * configuren en /notificaciones reciben además por los canales que elijan.
 */
export async function notificarCompraAutorizada(
  prisma: ScopedPrismaClient,
  empresaId: string,
  compra: { id: string; numero: string }
) {
  const mensaje = `La orden de compra ${compra.numero} fue autorizada por gerencia — ya se puede comprar.`;
  const asunto = `Compra autorizada: ${compra.numero}`;
  const href = "/compras";

  const destinatariosFijos = await usuariosDeEmpresaPorRol(prisma, empresaId, ROLES_FIJOS_COMPRA_AUTORIZADA);
  await enviarPorCanalesConfigurados(
    prisma,
    empresaId,
    destinatariosFijos,
    ["EMAIL", "EN_APP"],
    "COMPRA_AUTORIZADA",
    asunto,
    mensaje,
    href
  );

  const regla = await obtenerReglaNotificacion(prisma, empresaId, "COMPRA_AUTORIZADA");
  const rolesExtra = regla.roles.filter((r) => !ROLES_FIJOS_COMPRA_AUTORIZADA.includes(r));
  if (rolesExtra.length > 0 && regla.canales.length > 0) {
    const destinatariosExtra = await usuariosDeEmpresaPorRol(prisma, empresaId, rolesExtra);
    await enviarPorCanalesConfigurados(
      prisma,
      empresaId,
      destinatariosExtra,
      regla.canales,
      "COMPRA_AUTORIZADA",
      asunto,
      mensaje,
      href
    );
  }
}
