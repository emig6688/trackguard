import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  crearOrdenCompraManual,
  actualizarOrdenCompra,
  marcarCompraRealizada,
  cancelarOrdenCompra,
  asignarCompraAOrdenDeTrabajo,
  cargarFacturaCompra,
  subirPresupuestoCompra,
  aprobarCompra,
  rechazarCompra,
  aprobarCompraMantenimiento,
  rechazarCompraMantenimiento,
} from "@/app/_actions/compras";
import { AutorizacionError } from "@/lib/permisos";
import {
  crearEmpresaDePrueba,
  crearUsuarioDePrueba,
  mockearSesion,
  borrarEmpresaDePrueba,
} from "@/lib/test-fixtures";
import { RedirectDeTest } from "../../vitest.setup";
import type { ScopedPrismaClient } from "@/lib/tenant-prisma";

function formData(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

function sufijoCorto() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

describe("app/_actions/compras.ts", () => {
  let empresaId: string;
  let prisma: ScopedPrismaClient;
  let vehiculoId: string;
  let encargadoCompras: { id: string };
  let gerente: { id: string };
  let encargadoMantenimiento: { id: string };
  let mecanico: { id: string };

  beforeAll(async () => {
    const empresa = await crearEmpresaDePrueba("compras");
    empresaId = empresa.empresaId;
    prisma = empresa.prisma;

    encargadoCompras = await crearUsuarioDePrueba(empresaId, "ENCARGADO_COMPRAS");
    gerente = await crearUsuarioDePrueba(empresaId, "GERENTE");
    encargadoMantenimiento = await crearUsuarioDePrueba(empresaId, "ENCARGADO_MANTENIMIENTO");
    mecanico = await crearUsuarioDePrueba(empresaId, "MECANICO_INTERNO");

    const vehiculo = await prisma.vehiculo.create({
      data: { empresaId, patente: `TSTCPR${sufijoCorto()}`, marca: "Test", modelo: "Test", tipo: "CAMION" },
    });
    vehiculoId = vehiculo.id;
  });

  afterAll(async () => {
    await borrarEmpresaDePrueba(empresaId);
  });

  /**
   * crearOrdenCompraManual redirige (siempre, por diseño) cuando la compra
   * NO viene de una OT — así que no se puede leer su valor de retorno para
   * ese camino. Este helper crea la compra (asumiendo sesión ya mockeada),
   * atrapa el redirect esperado, y la vuelve a buscar por una descripción
   * de ítem única para poder seguir operando sobre ella en el resto del
   * test.
   */
  async function crearCompraSuelta(opts: {
    prioridad?: string;
    vehiculoId?: string;
    montoEstimado?: string;
    articuloPanolId?: string;
    descripcion?: string;
  }) {
    // Si viene ligada a un artículo del pañol, la descripción tiene que
    // coincidir exactamente con su nombre (ver validarItemsFilas) — por eso
    // se puede forzar acá en vez de usar siempre una al azar.
    const descripcion = opts.descripcion ?? `Item-${sufijoCorto()}`;
    const fd = formData({
      itemIds: "1",
      item_descripcion_1: descripcion,
      ...(opts.prioridad ? { prioridad: opts.prioridad } : {}),
      ...(opts.vehiculoId ? { vehiculoId: opts.vehiculoId } : {}),
      ...(opts.montoEstimado ? { montoEstimado: opts.montoEstimado } : {}),
      ...(opts.articuloPanolId ? { item_articuloPanolId_1: opts.articuloPanolId } : {}),
    });
    let resultado: Awaited<ReturnType<typeof crearOrdenCompraManual>>;
    try {
      resultado = await crearOrdenCompraManual(undefined, fd);
    } catch (err) {
      if (!(err instanceof RedirectDeTest)) throw err;
      resultado = undefined;
    }
    if (resultado?.error) throw new Error(`crearCompraSuelta: la creación falló: ${resultado.error}`);
    const compra = await prisma.ordenCompra.findFirstOrThrow({
      where: { items: { some: { descripcion } } },
      include: { items: { orderBy: { id: "asc" } } },
    });
    return { resultado, compra };
  }

  describe("crearOrdenCompraManual", () => {
    it("crea una compra suelta (sin OT) exigiendo prioridad y vehículo", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "ALTA", vehiculoId });
      expect(compra.prioridad).toBe("ALTA");
      expect(compra.vehiculoId).toBe(vehiculoId);
      expect(compra.origen).toBe("MANUAL");
    });

    it("rechaza una compra suelta sin prioridad", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const fd = formData({ itemIds: "1", item_descripcion_1: "Repuesto", vehiculoId });
      const resultado = await crearOrdenCompraManual(undefined, fd);
      expect(resultado?.error).toMatch(/prioridad/i);
    });

    it("rechaza una compra suelta sin vehículo", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const fd = formData({ itemIds: "1", item_descripcion_1: "Repuesto", prioridad: "BAJA" });
      const resultado = await crearOrdenCompraManual(undefined, fd);
      expect(resultado?.error).toMatch(/vehículo/i);
    });

    it("rechaza si no se agregó ningún ítem", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const fd = formData({ prioridad: "BAJA", vehiculoId });
      const resultado = await crearOrdenCompraManual(undefined, fd);
      expect(resultado?.error).toMatch(/repuesto/i);
    });

    it("un rol fuera de ROLES_CREAR_COMPRA no puede crear una compra", async () => {
      const chofer = await crearUsuarioDePrueba(empresaId, "CHOFER");
      mockearSesion({ id: chofer.id, rol: "CHOFER", empresaId });
      const fd = formData({ itemIds: "1", item_descripcion_1: "Repuesto", prioridad: "BAJA", vehiculoId });
      await expect(crearOrdenCompraManual(undefined, fd)).rejects.toThrow(AutorizacionError);
    });

    it("una compra generada desde una OT hereda prioridad y vehículo, ignorando lo que mande el form", async () => {
      const ot = await prisma.ordenDeTrabajo.create({
        data: {
          empresaId,
          numero: `OT-TEST-${sufijoCorto()}`,
          titulo: "Test",
          origen: "MANUAL",
          vehiculoId,
          prioridad: "URGENTE",
          estado: "APROBADA",
        },
      });
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const fd = formData({
        itemIds: "1",
        item_descripcion_1: `Item-${sufijoCorto()}`,
        ordenDeTrabajoId: ot.id,
        // A propósito manda una prioridad distinta — debe ignorarse.
        prioridad: "BAJA",
      });
      const resultado = await crearOrdenCompraManual(undefined, fd);
      expect(resultado?.error).toBeUndefined();
      const compra = await prisma.ordenCompra.findFirstOrThrow({ where: { numero: resultado!.numero } });
      expect(compra.prioridad).toBe("URGENTE");
      expect(compra.vehiculoId).toBe(vehiculoId);
      expect(compra.ordenDeTrabajoId).toBe(ot.id);
    });

    it("sin OT y sin ordenDeTrabajoId, al terminar redirige a /compras", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const fd = formData({
        itemIds: "1",
        item_descripcion_1: `Item-${sufijoCorto()}`,
        prioridad: "MEDIA",
        vehiculoId,
      });
      await expect(crearOrdenCompraManual(undefined, fd)).rejects.toThrow(RedirectDeTest);
    });

    it("requiere autorización de gerencia cuando el monto estimado supera el umbral de la empresa", async () => {
      await prisma.empresa.update({ where: { id: empresaId }, data: { montoAutorizacionCompra: 1000 } });
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "ALTA", vehiculoId, montoEstimado: "5000" });
      expect(compra.estadoAutorizacion).toBe("PENDIENTE");
      await prisma.empresa.update({ where: { id: empresaId }, data: { montoAutorizacionCompra: null } });
    });
  });

  describe("actualizarOrdenCompra", () => {
    it("edita una compra PENDIENTE (monto, observaciones)", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      const item = compra.items[0];

      const resultado = await actualizarOrdenCompra(
        compra.id,
        undefined,
        formData({
          itemIds: item.id,
          [`item_descripcion_${item.id}`]: "Editado",
          prioridad: "URGENTE",
          vehiculoId,
          observaciones: "nota nueva",
        })
      );
      expect(resultado?.error).toBeUndefined();
      const actualizada = await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } });
      expect(actualizada.prioridad).toBe("URGENTE");
      expect(actualizada.observaciones).toBe("nota nueva");
    });

    it("no permite editar una compra que ya no está PENDIENTE", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      await prisma.ordenCompra.update({ where: { id: compra.id }, data: { estado: "CANCELADA" } });

      const resultado = await actualizarOrdenCompra(
        compra.id,
        undefined,
        formData({ itemIds: "x", item_descripcion_x: "Editado", prioridad: "BAJA", vehiculoId })
      );
      expect(resultado?.error).toMatch(/no se puede editar/i);
    });
  });

  describe("marcarCompraRealizada / stock", () => {
    it("suma el stock del artículo de pañol al recibir la cantidad", async () => {
      const articulo = await prisma.articuloPanol.create({
        data: { empresaId, nombre: `Art-${sufijoCorto()}`, stockActual: 5, stockMinimo: 1 },
      });
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({
        prioridad: "BAJA",
        vehiculoId,
        articuloPanolId: articulo.id,
        descripcion: articulo.nombre,
      });
      const item = compra.items[0];

      await marcarCompraRealizada(
        compra.id,
        undefined,
        formData({ fechaCompra: "2026-01-01", [`cantidadRecibida_${item.id}`]: "3" })
      );

      const articuloActualizado = await prisma.articuloPanol.findUniqueOrThrow({ where: { id: articulo.id } });
      expect(articuloActualizado.stockActual).toBe(8);
      const compraActualizada = await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } });
      expect(compraActualizada.estado).toBe("REALIZADA");
    });

    it("no permite marcar realizada una compra pendiente de autorización de gerencia", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      await prisma.ordenCompra.update({ where: { id: compra.id }, data: { estadoAutorizacion: "PENDIENTE" } });

      await expect(
        marcarCompraRealizada(compra.id, undefined, formData({ fechaCompra: "2026-01-01" }))
      ).rejects.toThrow(AutorizacionError);
    });
  });

  describe("cancelarOrdenCompra / asignarCompraAOrdenDeTrabajo / cargarFacturaCompra", () => {
    it("cancela una compra", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      await cancelarOrdenCompra(compra.id);
      const actualizada = await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } });
      expect(actualizada.estado).toBe("CANCELADA");
    });

    it("asigna/desasigna una compra a una OT", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      const ot = await prisma.ordenDeTrabajo.create({
        data: {
          empresaId,
          numero: `OT-ASIG-${sufijoCorto()}`,
          titulo: "Test",
          origen: "MANUAL",
          vehiculoId,
          estado: "APROBADA",
        },
      });
      await asignarCompraAOrdenDeTrabajo(compra.id, ot.id);
      expect((await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } })).ordenDeTrabajoId).toBe(ot.id);
      await asignarCompraAOrdenDeTrabajo(compra.id, null);
      expect((await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } })).ordenDeTrabajoId).toBeNull();
    });

    it("cargarFacturaCompra exige una compra REALIZADA y un archivo", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });

      const sinArchivo = await cargarFacturaCompra(compra.id, undefined, formData({}));
      expect(sinArchivo?.error).toMatch(/factura/i);

      const fdConArchivo = formData({});
      fdConArchivo.set("archivoFactura", new File(["contenido"], "factura.pdf", { type: "application/pdf" }));
      const resultadoEstadoInvalido = await cargarFacturaCompra(compra.id, undefined, fdConArchivo);
      expect(resultadoEstadoInvalido?.error).toMatch(/no está en condiciones/i);

      await prisma.ordenCompra.update({ where: { id: compra.id }, data: { estado: "REALIZADA" } });
      const ok = await cargarFacturaCompra(compra.id, undefined, fdConArchivo);
      expect(ok?.error).toBeUndefined();
      expect((await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } })).estado).toBe("DOCUMENTADA");
    });
  });

  describe("subirPresupuestoCompra", () => {
    it("exige archivo, monto y proveedor", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });

      expect((await subirPresupuestoCompra(compra.id, undefined, formData({})))?.error).toMatch(/presupuesto/i);

      const fdSinMonto = formData({});
      fdSinMonto.set("archivo", new File(["x"], "p.pdf", { type: "application/pdf" }));
      expect((await subirPresupuestoCompra(compra.id, undefined, fdSinMonto))?.error).toMatch(/monto/i);

      const fdSinProveedor = formData({ monto: "1000" });
      fdSinProveedor.set("archivo", new File(["x"], "p.pdf", { type: "application/pdf" }));
      expect((await subirPresupuestoCompra(compra.id, undefined, fdSinProveedor))?.error).toMatch(/proveedor/i);

      const fdOk = formData({ monto: "1000", proveedor: "Proveedor SRL" });
      fdOk.set("archivo", new File(["x"], "p.pdf", { type: "application/pdf" }));
      const ok = await subirPresupuestoCompra(compra.id, undefined, fdOk);
      expect(ok?.error).toBeUndefined();
      const presupuesto = await prisma.presupuestoCompra.findFirstOrThrow({ where: { ordenCompraId: compra.id } });
      expect(Number(presupuesto.monto)).toBe(1000);
      expect(presupuesto.proveedor).toBe("Proveedor SRL");
    });
  });

  describe("aprobarCompra / rechazarCompra (gerencia)", () => {
    it("aprueba una compra pendiente de autorización", async () => {
      await prisma.empresa.update({ where: { id: empresaId }, data: { montoAutorizacionCompra: 100 } });
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId, montoEstimado: "5000" });
      expect(compra.estadoAutorizacion).toBe("PENDIENTE");

      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await aprobarCompra(compra.id);
      expect((await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } })).estadoAutorizacion).toBe(
        "APROBADA"
      );
      await prisma.empresa.update({ where: { id: empresaId }, data: { montoAutorizacionCompra: null } });
    });

    it("un rol fuera de ROLES_AUTORIZAR_COMPRA no puede aprobar", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      await expect(aprobarCompra(compra.id)).rejects.toThrow(AutorizacionError);
    });

    it("rechaza una compra", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await rechazarCompra(compra.id);
      expect((await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } })).estadoAutorizacion).toBe(
        "RECHAZADA"
      );
    });
  });

  describe("aprobarCompraMantenimiento / rechazarCompraMantenimiento", () => {
    it("aprueba/rechaza la compuerta de mantenimiento, independiente de la de gerencia", async () => {
      mockearSesion({ id: mecanico.id, rol: "MECANICO_INTERNO", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      await prisma.ordenCompra.update({
        where: { id: compra.id },
        data: { estadoAutorizacionMantenimiento: "PENDIENTE" },
      });

      mockearSesion({ id: encargadoMantenimiento.id, rol: "ENCARGADO_MANTENIMIENTO", empresaId });
      await aprobarCompraMantenimiento(compra.id);
      expect(
        (await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } })).estadoAutorizacionMantenimiento
      ).toBe("APROBADA");

      await rechazarCompraMantenimiento(compra.id);
      expect(
        (await prisma.ordenCompra.findUniqueOrThrow({ where: { id: compra.id } })).estadoAutorizacionMantenimiento
      ).toBe("RECHAZADA");
    });

    it("un rol fuera de ROLES_AUTORIZAR_COMPRA_MECANICO no puede aprobar", async () => {
      mockearSesion({ id: encargadoCompras.id, rol: "ENCARGADO_COMPRAS", empresaId });
      const { compra } = await crearCompraSuelta({ prioridad: "BAJA", vehiculoId });
      mockearSesion({ id: gerente.id, rol: "GERENTE", empresaId });
      await expect(aprobarCompraMantenimiento(compra.id)).rejects.toThrow(AutorizacionError);
    });
  });
});
