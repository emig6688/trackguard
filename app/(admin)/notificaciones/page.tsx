import { requireEmpresa } from "@/lib/permisos";
import { BackToDashboard } from "@/components/back-to-dashboard";
import { CATALOGO_NOTIFICACIONES } from "@/lib/notificaciones";
import { ReglaNotificacionForm } from "@/components/notificaciones/regla-notificacion-form";
import { MontoAutorizacionForm } from "@/components/notificaciones/monto-autorizacion-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TipoNotificacion } from "@/app/generated/prisma/client";

export default async function NotificacionesPage() {
  const { user, prisma } = await requireEmpresa();
  const [reglas, empresa] = await Promise.all([
    prisma.reglaNotificacion.findMany({}),
    prisma.empresa.findUniqueOrThrow({ where: { id: user.empresaId! } }),
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
                  activoInicial={regla?.activo ?? true}
                  usaDiasAviso={info.usaDiasAviso}
                  usaHoraEnvio={info.usaHoraEnvio}
                  horaEnvioInicial={regla?.horaEnvio ?? null}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
