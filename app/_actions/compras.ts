"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireRole,
  ROLES_COMPRAS,
  ROLES_CREAR_COMPRA,
  ROLES_AUTORIZAR_COMPRA,
  ROLES_AUTORIZAR_COMPRA_MECANICO,
  AutorizacionError,
  usuariosDeEmpresaPorRol,
} from "@/lib/permisos";
import { optionalNumber } from "@/lib/zod-helpers";
import { puedeMecanicoAccionar } from "@/lib/ot";
import { calcularRequiereAutorizacion } from "@/lib/compras";
import { generarNumeroCompra, notificarNuevaOrdenCompra } from "@/lib/panol";
import { guardarArchivo } from "@/lib/storage";
import {
  obtenerReglaNotificacion,
  enviarPorCanalesConfigurados,
  notificarCompraPendienteAutorizacion,
  notificarCompraMecanicoPendienteAutorizacion,
  notificarPresupuestoSubido,
  notificarCompraAutorizada,
} from "@/lib/notificaciones";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import type { Prisma } from "@/app/generated/prisma/client";

function leerFilas(formData: FormData, idsCsv: FormDataEntryValue | null, campos: string[]) {
  const ids = ((idsCsv as string | null) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return ids
    .map((id) => {
      const fila: Record<string, string> = { id };
      for (const campo of campos) {
        fila[campo] = ((formData.get(`${campo}_${id}`) as string | null) ?? "").trim();
      }
      return fila;
    })
    .filter((fila) => campos.some((campo) => fila[campo] !== ""));
}

const compraManualSchema = z.object({
  montoEstimado: optionalNumber(),
  ordenDeTrabajoId: z.string().trim().optional(),
  otItemPreventivoId: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

/**
 * Valida las filas de repuestos de un formulario de OC (crear o editar):
 * cada una necesita descripción, y si viene de un artículo del pañol la
 * descripción tiene que coincidir exactamente para no sumar el stock a otro
 * artículo.
 */
async function validarItemsFilas(
  prisma: ScopedPrismaClient,
  itemsFilas: Record<string, string>[]
): Promise<string | null> {
  if (itemsFilas.length === 0) return "Agregá al menos un repuesto.";
  for (const fila of itemsFilas) {
    if (!fila.item_descripcion) return "Completá la descripción de cada repuesto.";
    if (fila.item_articuloPanolId) {
      const articulo = await prisma.articuloPanol.findUniqueOrThrow({
        where: { id: fila.item_articuloPanolId },
      });
      if (fila.item_descripcion !== articulo.nombre) {
        return `Lo que estás pidiendo tiene que coincidir exactamente con el artículo del pañol elegido ("${articulo.nombre}"), para no sumar el stock a otro artículo.`;
      }
    }
  }
  return null;
}

export type CompraFormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[]>;
      numero?: string;
      requiereAutorizacion?: boolean;
    }
  | undefined;

export async function crearOrdenCompraManual(
  _prevState: CompraFormState,
  formData: FormData
): Promise<CompraFormState> {
  const { user, prisma } = await requireRole(ROLES_CREAR_COMPRA);

  const parsed = compraManualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const itemsFilas = leerFilas(formData, formData.get("itemIds"), [
    "item_descripcion",
    "item_cantidad",
    "item_articuloPanolId",
  ]);
  const errorItems = await validarItemsFilas(prisma, itemsFilas);
  if (errorItems) return { error: errorItems };

  if (parsed.data.ordenDeTrabajoId) {
    // findUniqueOrThrow ya viene scoped por tenant (ver tenant-prisma.ts):
    // una OT de otra empresa tira acá antes de poder asociarla a esta compra.
    const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({
      where: { id: parsed.data.ordenDeTrabajoId },
    });
    if (user.rol === "MECANICO_INTERNO" && !puedeMecanicoAccionar(ot, user.id)) {
      return { error: "Solo podés pedir compras para una orden de trabajo que tengas asignada." };
    }
  }

  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: user.empresaId! } });
  const umbral = empresa.montoAutorizacionCompra;
  const umbralMecanico = user.rol === "MECANICO_INTERNO" ? empresa.montoAutorizacionCompraMecanico : null;
  if ((umbral != null || umbralMecanico != null) && parsed.data.montoEstimado == null) {
    return {
      error: `Ingresá el monto estimado de la compra: hay un tope de autorización configurado ($${umbral ?? umbralMecanico}).`,
    };
  }
  const requiereAutorizacion = calcularRequiereAutorizacion(parsed.data.montoEstimado, umbral);
  const requiereAutorizacionMantenimiento = calcularRequiereAutorizacion(parsed.data.montoEstimado, umbralMecanico);

  const itemsData: Prisma.OrdenCompraItemUncheckedCreateWithoutOrdenCompraInput[] = [];
  for (const fila of itemsFilas) {
    const foto = formData.get(`item_foto_${fila.id}`);
    const tieneFoto = foto instanceof File && foto.size > 0;
    const archivoId = tieneFoto
      ? (await guardarArchivo(prisma, user.empresaId!, foto as File, user.id)).id
      : undefined;
    itemsData.push({
      descripcion: fila.item_descripcion,
      cantidadSolicitada: fila.item_cantidad ? Number(fila.item_cantidad) : undefined,
      articuloPanolId: fila.item_articuloPanolId || undefined,
      archivoId,
    });
  }

  const numero = await generarNumeroCompra(prisma);
  const compra = await prisma.ordenCompra.create({
    data: {
      empresaId: user.empresaId!,
      numero,
      origen: "MANUAL",
      montoEstimado: parsed.data.montoEstimado,
      observaciones: parsed.data.observaciones || undefined,
      estadoAutorizacion: requiereAutorizacion ? "PENDIENTE" : "NO_REQUERIDA",
      estadoAutorizacionMantenimiento: requiereAutorizacionMantenimiento ? "PENDIENTE" : "NO_REQUERIDA",
      ordenDeTrabajoId: parsed.data.ordenDeTrabajoId || undefined,
      otItemPreventivoId: parsed.data.otItemPreventivoId || undefined,
      creadoPorId: user.id,
      items: { create: itemsData },
    },
    include: { items: { orderBy: { id: "asc" } } },
  });

  if (requiereAutorizacion) {
    await notificarCompraPendienteAutorizacion(prisma, user.empresaId!, {
      id: compra.id,
      numero,
      montoEstimado: compra.montoEstimado?.toString() ?? null,
    });
  }
  if (requiereAutorizacionMantenimiento) {
    await notificarCompraMecanicoPendienteAutorizacion(prisma, user.empresaId!, {
      id: compra.id,
      numero,
      montoEstimado: compra.montoEstimado?.toString() ?? null,
    });
  }
  if (!requiereAutorizacion && !requiereAutorizacionMantenimiento) {
    await notificarNuevaOrdenCompra(prisma, user.empresaId!, {
      numero,
      descripcion: compra.items.map((i) => i.descripcion).join(", "),
      cantidadSolicitada: null,
    });
  }

  revalidatePath("/compras");
  // Generada desde un ítem de OT: no navega afuera, se queda en la OT para
  // mostrar la confirmación con el número recién creado.
  if (parsed.data.ordenDeTrabajoId) {
    revalidatePath(`/ordenes-trabajo/${parsed.data.ordenDeTrabajoId}`);
    return { numero, requiereAutorizacion };
  }
  redirect("/compras");
}

/**
 * Edita una OC mientras sigue PENDIENTE (todavía no se compró) — cambia
 * repuestos (agregar/quitar/editar, conservando la foto de un ítem si no se
 * sube una nueva), monto estimado, observaciones y la OT asociada. Si el
 * nuevo monto pasa a requerir autorización (o deja de requerirla), se
 * recalcula estadoAutorizacion igual que al crear; una aprobación o rechazo
 * previo queda invalidado si la edición la vuelve a poner pendiente.
 */
export async function actualizarOrdenCompra(
  compraId: string,
  _prevState: CompraFormState,
  formData: FormData
): Promise<CompraFormState> {
  const { user, prisma } = await requireRole(ROLES_CREAR_COMPRA);

  const compraActual = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id: compraId },
    include: { items: { orderBy: { id: "asc" } }, creadoPor: { select: { rol: true } } },
  });
  if (compraActual.estado !== "PENDIENTE") {
    return { error: "Esta compra ya no se puede editar." };
  }

  const parsed = compraManualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const itemsFilas = leerFilas(formData, formData.get("itemIds"), [
    "item_descripcion",
    "item_cantidad",
    "item_articuloPanolId",
  ]);
  const errorItems = await validarItemsFilas(prisma, itemsFilas);
  if (errorItems) return { error: errorItems };

  if (parsed.data.ordenDeTrabajoId) {
    const ot = await prisma.ordenDeTrabajo.findUniqueOrThrow({
      where: { id: parsed.data.ordenDeTrabajoId },
    });
    if (user.rol === "MECANICO_INTERNO" && !puedeMecanicoAccionar(ot, user.id)) {
      return { error: "Solo podés pedir compras para una orden de trabajo que tengas asignada." };
    }
  }

  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: user.empresaId! } });
  const umbral = empresa.montoAutorizacionCompra;
  const umbralMecanico =
    compraActual.creadoPor?.rol === "MECANICO_INTERNO" ? empresa.montoAutorizacionCompraMecanico : null;
  if ((umbral != null || umbralMecanico != null) && parsed.data.montoEstimado == null) {
    return {
      error: `Ingresá el monto estimado de la compra: hay un tope de autorización configurado ($${umbral ?? umbralMecanico}).`,
    };
  }
  const requiereAutorizacion = calcularRequiereAutorizacion(parsed.data.montoEstimado, umbral);
  const requiereAutorizacionMantenimiento = calcularRequiereAutorizacion(parsed.data.montoEstimado, umbralMecanico);

  const itemsExistentes = new Map(compraActual.items.map((i) => [i.id, i]));
  const idsEnviados = new Set(itemsFilas.map((f) => f.id));
  const idsABorrar = compraActual.items.filter((i) => !idsEnviados.has(i.id)).map((i) => i.id);

  if (idsABorrar.length > 0) {
    await prisma.ordenCompraItem.deleteMany({ where: { id: { in: idsABorrar } } });
  }

  for (const fila of itemsFilas) {
    const foto = formData.get(`item_foto_${fila.id}`);
    const tieneFotoNueva = foto instanceof File && foto.size > 0;
    const archivoIdNuevo = tieneFotoNueva
      ? (await guardarArchivo(prisma, user.empresaId!, foto as File, user.id)).id
      : undefined;

    const existente = itemsExistentes.get(fila.id);
    const data = {
      descripcion: fila.item_descripcion,
      cantidadSolicitada: fila.item_cantidad ? Number(fila.item_cantidad) : null,
      articuloPanolId: fila.item_articuloPanolId || null,
      ...(archivoIdNuevo ? { archivoId: archivoIdNuevo } : {}),
    };
    if (existente) {
      await prisma.ordenCompraItem.update({ where: { id: existente.id }, data });
    } else {
      await prisma.ordenCompraItem.create({ data: { ...data, ordenCompraId: compraId } });
    }
  }

  const nuevoEstadoAutorizacion = requiereAutorizacion ? "PENDIENTE" : "NO_REQUERIDA";
  const nuevoEstadoAutorizacionMantenimiento = requiereAutorizacionMantenimiento ? "PENDIENTE" : "NO_REQUERIDA";
  const notificar = requiereAutorizacion && compraActual.estadoAutorizacion !== "PENDIENTE";
  const notificarMantenimiento =
    requiereAutorizacionMantenimiento && compraActual.estadoAutorizacionMantenimiento !== "PENDIENTE";
  const limpiarAutorizacionPrevia =
    nuevoEstadoAutorizacion === "PENDIENTE" && compraActual.estadoAutorizacion !== "PENDIENTE";
  const limpiarAutorizacionMantenimientoPrevia =
    nuevoEstadoAutorizacionMantenimiento === "PENDIENTE" &&
    compraActual.estadoAutorizacionMantenimiento !== "PENDIENTE";

  const compra = await prisma.ordenCompra.update({
    where: { id: compraId },
    data: {
      montoEstimado: parsed.data.montoEstimado,
      observaciones: parsed.data.observaciones || undefined,
      ordenDeTrabajoId: parsed.data.ordenDeTrabajoId || null,
      estadoAutorizacion: nuevoEstadoAutorizacion,
      ...(limpiarAutorizacionPrevia
        ? { autorizadoPorId: null, autorizadoEn: null, presupuestoAprobadoId: null }
        : {}),
      estadoAutorizacionMantenimiento: nuevoEstadoAutorizacionMantenimiento,
      ...(limpiarAutorizacionMantenimientoPrevia
        ? { autorizadoMantenimientoPorId: null, autorizadoMantenimientoEn: null }
        : {}),
    },
    include: { items: { orderBy: { id: "asc" } } },
  });

  if (notificar) {
    await notificarCompraPendienteAutorizacion(prisma, user.empresaId!, {
      id: compra.id,
      numero: compra.numero,
      montoEstimado: compra.montoEstimado?.toString() ?? null,
    });
  }
  if (notificarMantenimiento) {
    await notificarCompraMecanicoPendienteAutorizacion(prisma, user.empresaId!, {
      id: compra.id,
      numero: compra.numero,
      montoEstimado: compra.montoEstimado?.toString() ?? null,
    });
  }

  revalidatePath("/compras");
  revalidatePath("/autorizaciones");
  if (compraActual.ordenDeTrabajoId) revalidatePath(`/ordenes-trabajo/${compraActual.ordenDeTrabajoId}`);
  if (parsed.data.ordenDeTrabajoId) revalidatePath(`/ordenes-trabajo/${parsed.data.ordenDeTrabajoId}`);

  return { numero: compra.numero, requiereAutorizacion };
}

const realizarSchema = z.object({
  montoTotal: optionalNumber(),
  proveedor: z.string().trim().optional(),
  fechaCompra: z
    .string()
    .min(1, "Fecha requerida")
    .transform((v) => new Date(v)),
  observaciones: z.string().trim().optional(),
});

export type RealizarCompraState = { error?: string } | undefined;

export async function marcarCompraRealizada(
  compraId: string,
  _prevState: RealizarCompraState,
  formData: FormData
): Promise<RealizarCompraState> {
  const { user, prisma } = await requireRole(ROLES_COMPRAS);
  const parsedResult = realizarSchema.safeParse(Object.fromEntries(formData));
  if (!parsedResult.success) {
    return { error: parsedResult.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const parsed = parsedResult.data;

  const compraActual = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id: compraId },
    include: { items: { orderBy: { id: "asc" } }, creadoPor: { select: { rol: true } } },
  });
  if (compraActual.estadoAutorizacion === "PENDIENTE" || compraActual.estadoAutorizacion === "RECHAZADA") {
    throw new AutorizacionError("Esta compra está sujeta a autorización de gerencia y todavía no fue aprobada.");
  }
  if (
    compraActual.estadoAutorizacionMantenimiento === "PENDIENTE" ||
    compraActual.estadoAutorizacionMantenimiento === "RECHAZADA"
  ) {
    throw new AutorizacionError(
      "Esta compra está sujeta a autorización de encargado de mantenimiento y todavía no fue aprobada."
    );
  }

  // El monto estimado al crear la OC puede haber quedado por debajo del
  // tope (o no haberse cargado ninguno, si la función estaba desactivada en
  // ese momento) — si el monto real de la compra ahora lo supera, no se
  // puede confirmar la carga directo: queda pendiente de autorización de
  // gerencia (o de mantenimiento, si la creó un mecánico interno), igual
  // que si se hubiera estimado así desde el principio.
  if (compraActual.estadoAutorizacion === "NO_REQUERIDA" && parsed.montoTotal != null) {
    const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: user.empresaId! } });
    const umbral = empresa.montoAutorizacionCompra;
    if (umbral != null && parsed.montoTotal > Number(umbral)) {
      await prisma.ordenCompra.update({
        where: { id: compraId },
        data: { estadoAutorizacion: "PENDIENTE", montoEstimado: parsed.montoTotal },
      });
      await notificarCompraPendienteAutorizacion(prisma, user.empresaId!, {
        id: compraId,
        numero: compraActual.numero,
        montoEstimado: String(parsed.montoTotal),
      });
      revalidatePath("/compras");
      revalidatePath("/autorizaciones");
      return {
        error: `El monto ingresado ($${parsed.montoTotal}) supera el tope de autorización configurado — esta compra quedó pendiente de que gerencia la apruebe. Podés subir presupuestos mientras tanto; una vez aprobada, volvé a cargarla.`,
      };
    }
  }
  if (
    compraActual.estadoAutorizacionMantenimiento === "NO_REQUERIDA" &&
    compraActual.creadoPor?.rol === "MECANICO_INTERNO" &&
    parsed.montoTotal != null
  ) {
    const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: user.empresaId! } });
    const umbralMecanico = empresa.montoAutorizacionCompraMecanico;
    if (umbralMecanico != null && parsed.montoTotal > Number(umbralMecanico)) {
      await prisma.ordenCompra.update({
        where: { id: compraId },
        data: { estadoAutorizacionMantenimiento: "PENDIENTE", montoEstimado: parsed.montoTotal },
      });
      await notificarCompraMecanicoPendienteAutorizacion(prisma, user.empresaId!, {
        id: compraId,
        numero: compraActual.numero,
        montoEstimado: String(parsed.montoTotal),
      });
      revalidatePath("/compras");
      revalidatePath("/autorizaciones");
      return {
        error: `El monto ingresado ($${parsed.montoTotal}) supera el tope de autorización de mantenimiento configurado — esta compra quedó pendiente de que encargado de mantenimiento la apruebe. Volvé a cargarla una vez aprobada.`,
      };
    }
  }

  const file = formData.get("archivoFactura");
  const tieneFactura = file instanceof File && file.size > 0;
  const facturaArchivoId = tieneFactura
    ? (await guardarArchivo(prisma, user.empresaId!, file as File, user.id)).id
    : undefined;

  for (const item of compraActual.items) {
    const cantidadRecibida = formData.get(`cantidadRecibida_${item.id}`);
    const cantidad =
      typeof cantidadRecibida === "string" && cantidadRecibida.trim() !== ""
        ? Number(cantidadRecibida)
        : null;
    if (cantidad != null) {
      await prisma.ordenCompraItem.update({ where: { id: item.id }, data: { cantidadRecibida: cantidad } });
      if (item.articuloPanolId) {
        await prisma.articuloPanol.update({
          where: { id: item.articuloPanolId },
          data: { stockActual: { increment: cantidad } },
        });
      }
    }
  }

  const compra = await prisma.ordenCompra.update({
    where: { id: compraId },
    data: {
      estado: tieneFactura ? "DOCUMENTADA" : "REALIZADA",
      montoTotal: parsed.montoTotal,
      proveedor: parsed.proveedor,
      fechaCompra: parsed.fechaCompra,
      observaciones: parsed.observaciones,
      facturaArchivoId,
    },
    include: { creadoPor: true, items: { orderBy: { id: "asc" } } },
  });

  await notificarCompraRealizada(prisma, user.empresaId!, compra);

  revalidatePath("/compras");
  revalidatePath("/panol");
  revalidatePath("/dashboard");
}

/**
 * Avisa a quien pidió la compra que ya se realizó (siempre por email + en la
 * app, no depende de la regla) y, si hay roles extra configurados en el
 * mantenedor de notificaciones, también a esos por los canales elegidos.
 */
async function notificarCompraRealizada(
  prisma: ScopedPrismaClient,
  empresaId: string,
  compra: {
    numero: string;
    montoTotal: Prisma.Decimal | null;
    items: { descripcion: string }[];
    creadoPor: { id: string; telefono: string | null; email: string } | null;
  }
) {
  const descripcion = compra.items.map((i) => i.descripcion).join(", ");
  const mensaje = `La orden de compra ${compra.numero} (${descripcion}) ya fue realizada${
    compra.montoTotal ? ` por $${compra.montoTotal.toString()}` : ""
  }.`;
  const asunto = `Orden de compra realizada: ${compra.numero}`;

  if (compra.creadoPor) {
    await enviarPorCanalesConfigurados(
      prisma,
      empresaId,
      [compra.creadoPor],
      ["EMAIL", "EN_APP"],
      "COMPRA_REALIZADA",
      asunto,
      mensaje,
      "/compras"
    );
  }

  const regla = await obtenerReglaNotificacion(prisma, empresaId, "COMPRA_REALIZADA");
  if (regla.roles.length > 0 && regla.canales.length > 0) {
    const destinatariosExtra = await usuariosDeEmpresaPorRol(prisma, empresaId, regla.roles);
    await enviarPorCanalesConfigurados(
      prisma,
      empresaId,
      destinatariosExtra,
      regla.canales,
      "COMPRA_REALIZADA",
      asunto,
      mensaje,
      "/compras"
    );
  }
}

export async function cancelarOrdenCompra(compraId: string) {
  const { prisma } = await requireRole(ROLES_COMPRAS);
  await prisma.ordenCompra.update({ where: { id: compraId }, data: { estado: "CANCELADA" } });
  revalidatePath("/compras");
}

export async function asignarCompraAOrdenDeTrabajo(compraId: string, ordenDeTrabajoId: string | null) {
  const { prisma } = await requireRole(ROLES_COMPRAS);
  await prisma.ordenCompra.update({
    where: { id: compraId },
    data: { ordenDeTrabajoId },
  });
  revalidatePath("/compras");
  if (ordenDeTrabajoId) revalidatePath(`/ordenes-trabajo/${ordenDeTrabajoId}`);
}

const cargarFacturaCompraSchema = z.object({
  montoTotal: optionalNumber(),
  proveedor: z.string().trim().optional(),
});

export type CargarFacturaCompraState = { error?: string } | undefined;

/**
 * Adjunta la factura a una compra ya realizada (cuando no se cargó en el
 * momento) — pasa de REALIZADA a DOCUMENTADA. Solo tiene sentido sobre una
 * compra ya comprada: no se puede documentar algo que todavía no se pagó.
 */
export async function cargarFacturaCompra(
  compraId: string,
  _prevState: CargarFacturaCompraState,
  formData: FormData
): Promise<CargarFacturaCompraState> {
  const { user, prisma } = await requireRole(ROLES_COMPRAS);
  const parsedResult = cargarFacturaCompraSchema.safeParse(Object.fromEntries(formData));
  if (!parsedResult.success) {
    return { error: parsedResult.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const parsed = parsedResult.data;

  const file = formData.get("archivoFactura");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Subí una foto de la factura." };
  }

  const compra = await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compraId } });
  if (compra.estado !== "REALIZADA") {
    return { error: "Esta compra no está en condiciones de documentarse." };
  }

  const archivo = await guardarArchivo(prisma, user.empresaId!, file, user.id);

  await prisma.ordenCompra.update({
    where: { id: compraId },
    data: {
      estado: "DOCUMENTADA",
      facturaArchivoId: archivo.id,
      montoTotal: parsed.montoTotal ?? compra.montoTotal,
      proveedor: parsed.proveedor ?? compra.proveedor,
    },
  });

  revalidatePath("/compras");
  revalidatePath("/dashboard");
}

export type PresupuestoFormState = { error?: string } | undefined;

/**
 * El encargado de compras sube un presupuesto (foto o archivo) asociado a
 * una OC — normalmente una que está pendiente de autorización, para que la
 * gerencia tenga con qué decidir. Avisa siempre a gerencia.
 */
export async function subirPresupuestoCompra(
  compraId: string,
  _prevState: PresupuestoFormState,
  formData: FormData
): Promise<PresupuestoFormState> {
  const { user, prisma } = await requireRole(ROLES_COMPRAS);

  const file = formData.get("archivo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Subí una foto o un archivo del presupuesto." };
  }
  const montoParsed = optionalNumber().safeParse(formData.get("monto"));
  const proveedor = ((formData.get("proveedor") as string | null) ?? "").trim() || undefined;

  const compra = await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compraId } });
  const archivo = await guardarArchivo(prisma, user.empresaId!, file, user.id);

  await prisma.presupuestoCompra.create({
    data: {
      ordenCompraId: compraId,
      archivoId: archivo.id,
      monto: montoParsed.success ? montoParsed.data : undefined,
      proveedor,
      subidoPorId: user.id,
    },
  });

  await notificarPresupuestoSubido(prisma, user.empresaId!, { id: compra.id, numero: compra.numero });

  revalidatePath("/compras");
  revalidatePath("/autorizaciones");
}

export async function aprobarCompra(compraId: string, presupuestoId?: string) {
  const { user, prisma } = await requireRole(ROLES_AUTORIZAR_COMPRA);

  // Confirma que la compra es de esta empresa (findUniqueOrThrow ya viene
  // scoped por tenant) ANTES de leer el presupuesto — PresupuestoCompra no
  // tiene empresaId propio (cuelga de OrdenCompra), así que sin este chequeo
  // se podría pasar un presupuestoId de otra empresa.
  if (presupuestoId) {
    await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compraId } });
  }

  if (presupuestoId) {
    const presupuesto = await prisma.presupuestoCompra.findUniqueOrThrow({
      where: { id: presupuestoId },
    });
    if (presupuesto.ordenCompraId !== compraId) throw new AutorizacionError();
  }

  const compra = await prisma.ordenCompra.update({
    where: { id: compraId },
    data: {
      estadoAutorizacion: "APROBADA",
      autorizadoPorId: user.id,
      autorizadoEn: new Date(),
      presupuestoAprobadoId: presupuestoId || undefined,
    },
  });

  await notificarCompraAutorizada(prisma, user.empresaId!, { id: compra.id, numero: compra.numero });

  revalidatePath("/autorizaciones");
  revalidatePath("/compras");
}

export async function rechazarCompra(compraId: string) {
  const { user, prisma } = await requireRole(ROLES_AUTORIZAR_COMPRA);

  await prisma.ordenCompra.update({
    where: { id: compraId },
    data: {
      estadoAutorizacion: "RECHAZADA",
      autorizadoPorId: user.id,
      autorizadoEn: new Date(),
    },
  });

  revalidatePath("/autorizaciones");
  revalidatePath("/compras");
}

/**
 * Aprobación de encargado de mantenimiento para una compra de mecánico —
 * compuerta aparte de aprobarCompra/rechazarCompra (gerencia), sin
 * presupuestos asociados: es un sí/no más simple.
 */
export async function aprobarCompraMantenimiento(compraId: string) {
  const { user, prisma } = await requireRole(ROLES_AUTORIZAR_COMPRA_MECANICO);

  await prisma.ordenCompra.update({
    where: { id: compraId },
    data: {
      estadoAutorizacionMantenimiento: "APROBADA",
      autorizadoMantenimientoPorId: user.id,
      autorizadoMantenimientoEn: new Date(),
    },
  });

  revalidatePath("/autorizaciones");
  revalidatePath("/compras");
}

export async function rechazarCompraMantenimiento(compraId: string) {
  const { user, prisma } = await requireRole(ROLES_AUTORIZAR_COMPRA_MECANICO);

  await prisma.ordenCompra.update({
    where: { id: compraId },
    data: {
      estadoAutorizacionMantenimiento: "RECHAZADA",
      autorizadoMantenimientoPorId: user.id,
      autorizadoMantenimientoEn: new Date(),
    },
  });

  revalidatePath("/autorizaciones");
  revalidatePath("/compras");
}
