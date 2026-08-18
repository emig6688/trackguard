import "server-only";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";
import { obtenerReglaNotificacion, enviarPorCanalesConfigurados } from "@/lib/notificaciones";
import { usuariosDeEmpresaPorRol } from "@/lib/permisos";

/**
 * Se basa en el número más alto ya usado (no en un count()): si se borra
 * cualquier OC del medio de la secuencia, un count() por sí solo puede
 * repetir un número que ya existe en una OC que sigue viva, y choca contra
 * la unicidad del número.
 */
export async function generarNumeroCompra(prisma: ScopedPrismaClient) {
  const anio = new Date().getFullYear();
  const prefijo = `OC-${anio}-`;
  const ultima = await prisma.ordenCompra.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const ultimoNumero = ultima ? parseInt(ultima.numero.slice(prefijo.length), 10) : 0;
  return `${prefijo}${String(ultimoNumero + 1).padStart(5, "0")}`;
}

/**
 * Avisa por los canales configurados en el mantenedor de notificaciones
 * (roles por defecto: encargados de compras) cuando se genera una OC nueva
 * (manual o por stock mínimo) — la idea es que se enteren sin tener que
 * entrar a mirar el listado.
 */
export async function notificarNuevaOrdenCompra(
  prisma: ScopedPrismaClient,
  empresaId: string,
  compra: { numero: string; descripcion: string; cantidadSolicitada: number | null }
) {
  const regla = await obtenerReglaNotificacion(prisma, empresaId, "NUEVA_ORDEN_COMPRA");
  if (regla.roles.length === 0 || regla.canales.length === 0) return;

  const destinatarios = await usuariosDeEmpresaPorRol(prisma, empresaId, regla.roles);
  const mensaje = `Nueva orden de compra ${compra.numero}: ${compra.descripcion}${
    compra.cantidadSolicitada ? ` x${compra.cantidadSolicitada}` : ""
  }`;
  await enviarPorCanalesConfigurados(
    prisma,
    empresaId,
    destinatarios,
    regla.canales,
    "NUEVA_ORDEN_COMPRA",
    `Nueva orden de compra ${compra.numero}`,
    mensaje,
    "/compras"
  );
}

/**
 * Descuenta el stock del artículo usado en una reparación y, si con eso cae
 * al mínimo o por debajo, dispara una orden de compra automática (si no hay
 * ya una pendiente para ese artículo, para no duplicar pedidos).
 */
export async function descontarStockYVerificarMinimo(
  prisma: ScopedPrismaClient,
  empresaId: string,
  articuloPanolId: string,
  cantidadUsada: number
) {
  const articulo = await prisma.articuloPanol.update({
    where: { id: articuloPanolId },
    data: { stockActual: { decrement: cantidadUsada } },
  });

  if (articulo.stockActual > articulo.stockMinimo) return;

  const yaExiste = await prisma.ordenCompraItem.findFirst({
    where: { articuloPanolId, ordenCompra: { estado: "PENDIENTE" } },
  });
  if (yaExiste) return;

  const numero = await generarNumeroCompra(prisma);
  const descripcion = `Reposición de stock: ${articulo.nombre}`;
  const cantidadSolicitada = Math.max(articulo.stockMinimo * 2 - articulo.stockActual, 1);
  await prisma.ordenCompra.create({
    data: {
      empresaId,
      numero,
      origen: "STOCK_MINIMO",
      estado: "PENDIENTE",
      items: {
        create: [{ articuloPanolId, descripcion, cantidadSolicitada }],
      },
    },
  });

  await notificarNuevaOrdenCompra(prisma, empresaId, { numero, descripcion, cantidadSolicitada });
}
