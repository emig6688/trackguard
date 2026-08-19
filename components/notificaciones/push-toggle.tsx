"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  obtenerVapidPublicKey,
  guardarPushSubscription,
  eliminarPushSubscription,
} from "@/app/_actions/pushSubscriptions";

type Estado = "cargando" | "no-soportado" | "requiere-instalar-ios" | "inactivo" | "activo";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Normalizado = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64Normalizado);
  return Uint8Array.from([...binario].map((c) => c.charCodeAt(0)));
}

function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function esStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Activa/desactiva el push real (llega aunque la app esté cerrada) para
 * este dispositivo puntual — no es un ajuste por tipo de aviso, replica
 * automáticamente todo lo que ya es "En la app" (ver lib/push.ts). En iOS,
 * Safari solo permite suscribirse si la app ya se agregó a la pantalla de
 * inicio (no hay forma de evitar ese paso, es una restricción del sistema).
 */
export function PushToggle() {
  const [estado, setEstado] = useState<Estado>("cargando");

  useEffect(() => {
    async function chequearEstado() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("no-soportado");
        return;
      }
      if (esIOS() && !esStandalone()) {
        setEstado("requiere-instalar-ios");
        return;
      }
      const registro = await navigator.serviceWorker.register("/sw.js");
      const suscripcion = await registro.pushManager.getSubscription();
      setEstado(suscripcion ? "activo" : "inactivo");
    }
    chequearEstado().catch(() => setEstado("no-soportado"));
  }, []);

  async function activar() {
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        toast.error("No se activaron las notificaciones", {
          description: "Tenés que dar permiso desde el navegador para poder activarlas.",
        });
        return;
      }

      const vapidPublicKey = await obtenerVapidPublicKey();
      if (!vapidPublicKey) {
        toast.error("Las notificaciones push no están configuradas todavía.");
        return;
      }

      const registro = await navigator.serviceWorker.register("/sw.js");
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await guardarPushSubscription(suscripcion.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }, navigator.userAgent);
      setEstado("activo");
      toast.success("Notificaciones push activadas en este dispositivo.");
    } catch {
      toast.error("No se pudieron activar las notificaciones push.");
    }
  }

  async function desactivar() {
    try {
      const registro = await navigator.serviceWorker.register("/sw.js");
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        await eliminarPushSubscription(suscripcion.endpoint);
        await suscripcion.unsubscribe();
      }
      setEstado("inactivo");
      toast.success("Notificaciones push desactivadas en este dispositivo.");
    } catch {
      toast.error("No se pudieron desactivar las notificaciones push.");
    }
  }

  if (estado === "cargando" || estado === "no-soportado") return null;

  if (estado === "requiere-instalar-ios") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() =>
          toast.info("Agregá TruckGuard a tu pantalla de inicio primero", {
            description: "En Safari: compartir → \"Agregar a pantalla de inicio\". Recién ahí se puede activar el push.",
          })
        }
      >
        <BellOff className="size-5" />
        <span className="sr-only">Notificaciones push (requiere instalar la app)</span>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={estado === "activo" ? desactivar : activar}>
      {estado === "activo" ? <BellRing className="size-5 text-primary" /> : <BellOff className="size-5" />}
      <span className="sr-only">{estado === "activo" ? "Desactivar notificaciones push" : "Activar notificaciones push"}</span>
    </Button>
  );
}
