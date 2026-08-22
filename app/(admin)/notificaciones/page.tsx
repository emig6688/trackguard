import { requireEmpresa } from "@/lib/permisos";
import { BackToDashboard } from "@/components/back-to-dashboard";
import { CATALOGO_NOTIFICACIONES } from "@/lib/notificaciones";
import { ReglaNotificacionForm } from "@/components/notificaciones/regla-notificacion-form";
import { MontoAutorizacionForm } from "@/components/notificaciones/monto-autorizacion-form";
import { actualizarMontoAutorizacionCompraMecanico } from "@/app/_actions/reglasNotificacion";
import { ChecklistTemplateForm } from "@/components/notificaciones/checklist-template-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TipoNotificacion } from "@/app/generated/prisma/client";

const CANAL_LABEL: Record<string, string> = { WHATSAPP: "WhatsApp", EMAIL: "Email" };

export default async function NotificacionesPage() {
  const { user, prisma } = await requireEmpresa();
  const [reglas, empresa, fallosRecientes, checklistTemplate] = await Promise.all([
    prisma.reglaNotificacion.findMany({}),
    prisma.empresa.findUniqueOrThrow({ where: { id: user.empresaId! } }),
    prisma.notificacionFallo.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.checklistTemplate.findFirst({
      where: { activo: true },
      include: { items: { orderBy: { orden: "asc" } } },
    }),
  ]);
  const reglaPorTipo = new Map(reglas.map((r) => [r.tipo, r]));

  const tipos = Object.keys(CATALOGO_NOTIFICACIONES) as TipoNotificacion[];

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <div>
        <h1 className="text-2xl font-semibold">Parámetros</h1>
        <p className="text-sm text-muted-foreground">
          Elegí qué roles reciben cada aviso automático de la app, por qué canal y —cuando aplica—
          con cuánta anticipación. Cada empresa define esto de forma independiente de las demás.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Autorización de compras</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Si una orden de compra estima superar este monto, queda pendiente de autorización de
            la gerencia antes de poder comprarse.
          </p>
          <MontoAutorizacionForm montoInicial={empresa.montoAutorizacionCompra?.toString() ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Autorización de compras de mecánicos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Si una orden de compra generada por un mecánico interno estima superar este monto,
            queda pendiente de autorización del encargado de mantenimiento antes de poder
            comprarse — compuerta aparte de la autorización de gerencia de arriba, que sigue
            funcionando igual.
          </p>
          <MontoAutorizacionForm
            montoInicial={empresa.montoAutorizacionCompraMecanico?.toString() ?? null}
            idPrefix="montoAutorizacionCompraMecanico"
            action={actualizarMontoAutorizacionCompraMecanico}
            descripcion="Si está desactivado, las compras de mecánicos no requieren autorización de mantenimiento sin importar el monto (siguen requiriendo la de gerencia de arriba, si aplica)."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist pre-salida</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Ítems que el chofer completa antes de salir con el vehículo. Guardar cambios crea una
            versión nueva del checklist — los ya completados conservan los ítems que tenían en su
            momento.
          </p>
          <ChecklistTemplateForm itemsIniciales={checklistTemplate?.items.map((i) => i.texto) ?? []} />
        </CardContent>
      </Card>

      {fallosRecientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fallos recientes de envío</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              WhatsApp y email son best-effort: si un envío falla (proveedor no configurado, sin
              teléfono/email, error del proveedor) no bloquea nada, pero queda registrado acá.
            </p>
            <ul className="space-y-2 text-sm">
              {fallosRecientes.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-b-0">
                  <Badge variant="outline">{CANAL_LABEL[f.canal] ?? f.canal}</Badge>
                  <span className="font-medium">{CATALOGO_NOTIFICACIONES[f.tipo]?.label ?? f.tipo}</span>
                  <span className="text-muted-foreground">
                    a {f.destinatario} — {f.motivo === "sin_email" || f.motivo === "sin_telefono"
                      ? "sin dato de contacto"
                      : f.motivo === "proveedor_no_configurado"
                        ? "proveedor no configurado"
                        : f.motivo}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {f.createdAt.toLocaleString("es-AR")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {tipos.map((tipo) => {
          const info = CATALOGO_NOTIFICACIONES[tipo];
          if (!info) return null;
          const regla = reglaPorTipo.get(tipo);
          return (
            <Card key={tipo}>
              <CardHeader>
                <CardTitle className="text-base">{info.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{info.disparador}</p>
                {info.destinatarioFijo && (
                  <p className="text-xs text-muted-foreground">
                    Siempre se avisa a: <span className="font-medium text-foreground">{info.destinatarioFijo}</span>
                    {" — además de los roles que elijas abajo."}
                  </p>
                )}
                <ReglaNotificacionForm
                  tipo={tipo}
                  rolesIniciales={regla?.roles ?? []}
                  canalesIniciales={regla?.canales ?? ["EMAIL", "EN_APP"]}
                  diasAvisoIniciales={regla?.diasAviso ?? [15, 7]}
                  activoInicial={regla?.activo ?? false}
                  usaDiasAviso={info.usaDiasAviso}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
