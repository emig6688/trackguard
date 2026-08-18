"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  obtenerNotificaciones,
  obtenerNotificacionesPendientesDePopup,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  type NotificacionResumen,
} from "@/app/_actions/notificaciones";

const INTERVALO_POLLING_MS = 45_000;

export function NotificationBell() {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<NotificacionResumen[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const mostradasEnToast = useRef(new Set<string>());

  const refrescarLista = useCallback(async () => {
    const { notificaciones, noLeidas } = await obtenerNotificaciones();
    setNotificaciones(notificaciones);
    setNoLeidas(noLeidas);
  }, []);

  const revisarPendientesDePopup = useCallback(async () => {
    const pendientes = await obtenerNotificacionesPendientesDePopup();
    if (pendientes.length === 0) return;

    for (const n of pendientes) {
      if (mostradasEnToast.current.has(n.id)) continue;
      mostradasEnToast.current.add(n.id);
      toast.info(n.titulo, {
        description: n.mensaje,
        ...(n.href
          ? {
              action: {
                label: "Ver",
                onClick: () => {
                  marcarNotificacionLeida(n.id);
                  router.push(n.href!);
                },
              },
            }
          : {}),
      });
    }
    await refrescarLista();
  }, [refrescarLista, router]);

  useEffect(() => {
    // Sincroniza con el store de notificaciones del servidor por polling
    // (no hay websockets/SSE en esta app) — es el caso de uso que useEffect
    // está pensado para cubrir, el lint solo no distingue esto de estado
    // derivado dentro de la función invocada.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling de un store externo (servidor), no estado derivado
    revisarPendientesDePopup();
    const intervalo = setInterval(revisarPendientesDePopup, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [revisarPendientesDePopup]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la lista con el servidor al abrir el popover
    if (abierto) refrescarLista();
  }, [abierto, refrescarLista]);

  async function abrirNotificacion(n: NotificacionResumen) {
    if (!n.leida) {
      setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      setNoLeidas((prev) => Math.max(0, prev - 1));
      await marcarNotificacionLeida(n.id);
    }
    setAbierto(false);
    if (n.href) router.push(n.href);
  }

  async function marcarTodas() {
    setNotificaciones((prev) => prev.map((x) => ({ ...x, leida: true })));
    setNoLeidas(0);
    await marcarTodasNotificacionesLeidas();
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-5" />
            {noLeidas > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] tabular-nums"
              >
                {noLeidas > 9 ? "9+" : noLeidas}
              </Badge>
            )}
            <span className="sr-only">Notificaciones</span>
          </Button>
        }
      />
      <PopoverContent align="end">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="font-medium">Notificaciones</p>
          {noLeidas > 0 && (
            <button
              type="button"
              onClick={marcarTodas}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notificaciones.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No tenés notificaciones.
            </p>
          )}
          {notificaciones.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => abrirNotificacion(n)}
              className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50"
            >
              {!n.leida && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              <div className={n.leida ? "ml-4 flex-1 space-y-0.5" : "flex-1 space-y-0.5"}>
                <p className="text-sm font-medium">{n.titulo}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{n.mensaje}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                </p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
