import "server-only";

export type EnvioEmailResultado =
  | { enviado: true }
  | { enviado: false; motivo: "sin_email" | "proveedor_no_configurado" | "error_proveedor" };

/**
 * Mismo criterio que lib/whatsapp.ts: nunca tira excepción (notificar es
 * best-effort). Sin RESEND_API_KEY configurado, solo deja constancia en el
 * log de qué se habría mandado. Con la variable seteada, manda el email real
 * vía la API REST de Resend (sin agregar su SDK como dependencia — es un
 * único POST). RESEND_FROM_EMAIL define el remitente; si no está seteada se
 * usa la dirección de pruebas de Resend, que solo entrega a la cuenta dueña
 * de la API key.
 */
export async function enviarEmail(
  destinatarioEmail: string | null | undefined,
  asunto: string,
  mensaje: string
): Promise<EnvioEmailResultado> {
  if (!destinatarioEmail || !destinatarioEmail.trim()) {
    console.warn("[Email] No se pudo notificar: falta el email del destinatario.");
    return { enviado: false, motivo: "sin_email" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Email] (proveedor no configurado) Se enviaría a ${destinatarioEmail}:\n${asunto}\n${mensaje}`);
    return { enviado: false, motivo: "proveedor_no_configurado" };
  }

  const remitente = process.env.RESEND_FROM_EMAIL || "TruckGuard <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [destinatarioEmail],
        subject: asunto,
        text: mensaje,
      }),
    });

    if (!res.ok) {
      console.error(`[Email] Resend respondió ${res.status} al notificar a ${destinatarioEmail}: ${await res.text()}`);
      return { enviado: false, motivo: "error_proveedor" };
    }

    return { enviado: true };
  } catch (error) {
    console.error(`[Email] Error de red notificando a ${destinatarioEmail}:`, error);
    return { enviado: false, motivo: "error_proveedor" };
  }
}
