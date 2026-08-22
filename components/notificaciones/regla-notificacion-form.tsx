"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { actualizarReglaNotificacion } from "@/app/_actions/reglasNotificacion";
import { ROL_LABEL, ROLES_NOTIFICABLES } from "@/lib/roles";
import type { CanalNotificacion, Rol, TipoNotificacion } from "@/app/generated/prisma/client";

const ROLES_SELECCIONABLES: { value: Rol; label: string }[] = ROLES_NOTIFICABLES.map((rol) => ({
  value: rol,
  label: ROL_LABEL[rol],
}));

const CANALES_SELECCIONABLES: { value: CanalNotificacion; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "EN_APP", label: "En la app" },
  { value: "WHATSAPP", label: "WhatsApp (sin proveedor conectado)" },
];

function mismoConjunto<T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function ReglaNotificacionForm({
  tipo,
  rolesIniciales,
  canalesIniciales,
  diasAvisoIniciales,
  activoInicial,
  usaDiasAviso,
}: {
  tipo: TipoNotificacion;
  rolesIniciales: Rol[];
  canalesIniciales: CanalNotificacion[];
  diasAvisoIniciales: number[];
  activoInicial: boolean;
  usaDiasAviso: boolean;
}) {
  const [roles, setRoles] = useState<Rol[]>(rolesIniciales);
  const [canales, setCanales] = useState<CanalNotificacion[]>(canalesIniciales);
  const [diasAviso, setDiasAviso] = useState<number[]>(diasAvisoIniciales);
  const [nuevoDia, setNuevoDia] = useState("");
  const [activo, setActivo] = useState(activoInicial);
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  const sinCambios =
    activo === activoInicial &&
    mismoConjunto(roles, rolesIniciales) &&
    mismoConjunto(canales, canalesIniciales) &&
    mismoConjunto(diasAviso, diasAvisoIniciales);

  function alternarRol(rol: Rol) {
    setGuardado(false);
    setRoles((prev) => (prev.includes(rol) ? prev.filter((r) => r !== rol) : [...prev, rol]));
  }

  function alternarCanal(canal: CanalNotificacion) {
    setGuardado(false);
    setCanales((prev) => (prev.includes(canal) ? prev.filter((c) => c !== canal) : [...prev, canal]));
  }

  function agregarDia() {
    const n = Number(nuevoDia);
    if (Number.isInteger(n) && n > 0 && !diasAviso.includes(n)) {
      setGuardado(false);
      setDiasAviso((prev) => [...prev, n].sort((a, b) => b - a));
    }
    setNuevoDia("");
  }

  function quitarDia(n: number) {
    setGuardado(false);
    setDiasAviso((prev) => prev.filter((d) => d !== n));
  }

  function guardar() {
    startTransition(async () => {
      await actualizarReglaNotificacion(tipo, roles, canales, diasAviso, activo);
      setGuardado(true);
    });
  }

  return (
    <div className="space-y-3">
      {usaDiasAviso && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Avisar con cuántos días de anticipación</p>
          <div className="flex flex-wrap items-center gap-2">
            {diasAviso.map((d) => (
              <Badge key={d} variant="secondary" className="gap-1.5">
                {d} días
                <button type="button" onClick={() => quitarDia(d)} className="text-muted-foreground hover:text-foreground">
                  ×
                </button>
              </Badge>
            ))}
            {diasAviso.length === 0 && (
              <span className="text-xs text-destructive">Sin días configurados: esta notificación no se va a enviar.</span>
            )}
            <Input
              type="number"
              min={1}
              value={nuevoDia}
              onChange={(e) => setNuevoDia(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregarDia();
                }
              }}
              placeholder="Ej: 30"
              className="h-7 w-20 text-sm"
            />
            <Button type="button" variant="outline" size="xs" onClick={agregarDia}>
              Agregar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Roles que reciben el aviso</p>
        <div className="flex flex-wrap gap-2">
          {ROLES_SELECCIONABLES.map((r) => (
            <button key={r.value} type="button" onClick={() => alternarRol(r.value)}>
              <Badge variant={roles.includes(r.value) ? "default" : "outline"}>{r.label}</Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Canal de envío</p>
        <div className="flex flex-wrap gap-2">
          {CANALES_SELECCIONABLES.map((c) => (
            <button key={c.value} type="button" onClick={() => alternarCanal(c.value)}>
              <Badge variant={canales.includes(c.value) ? "default" : "outline"}>{c.label}</Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setGuardado(false);
            setActivo((v) => !v);
          }}
        >
          <Badge variant={activo ? "success" : "secondary"}>
            {activo ? "Notificación activa" : "Notificación desactivada"}
          </Badge>
        </button>
        <Button type="button" size="sm" disabled={pending || sinCambios} onClick={guardar}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        {guardado && <span className="text-xs text-success">Guardado.</span>}
      </div>
    </div>
  );
}
