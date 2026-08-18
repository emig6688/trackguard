import "server-only";

export type EnvioWhatsappResultado =
  | { enviado: true }
  | { enviado: false; motivo: "sin_telefono" | "proveedor_no_configurado" };

/**
 * Todavía no hay un proveedor de WhatsApp conectado (se definirá más
 * adelante: Twilio, Meta WhatsApp Cloud API, etc.). Mientras tanto esta
 * función solo deja constancia en el log de qué se habría enviado, para que
 * el resto del flujo (completar OT, notificar al chofer) ya quede armado y
 * activarlo después sea nada más reemplazar el bloque de abajo por el POST
 * real a la API del proveedor elegido, usando credenciales desde variables
 * de entorno. Nunca debe tirar una excepción: notificar es best-effort y no
 * puede hacer fallar la acción que la dispara.
 */
export async function enviarWhatsapp(
  telefono: string | null | undefined,
  mensaje: string
): Promise<EnvioWhatsappResultado> {
  if (!telefono || !telefono.trim()) {
    console.warn("[WhatsApp] No se pudo notificar: falta el teléfono del destinatario.");
    return { enviado: false, motivo: "sin_telefono" };
  }

  console.log(`[WhatsApp] (proveedor no configurado) Se enviaría a ${telefono}:\n${mensaje}`);
  return { enviado: false, motivo: "proveedor_no_configurado" };
}
