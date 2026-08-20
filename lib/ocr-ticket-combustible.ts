import "server-only";

export type TicketCombustibleDetectado = {
  monto: number | null;
  litros: number | null;
  proveedor: string | null;
};

export type LecturaTicketResultado =
  | { leido: true; datos: TicketCombustibleDetectado }
  | { leido: false; motivo: "proveedor_no_configurado" | "error_proveedor" | "archivo_invalido" };

const PROMPT = `Sos un asistente que lee tickets o facturas de carga de combustible de camiones en Argentina. A partir de la imagen, extraé:
- monto: el importe TOTAL pagado, como número (sin el símbolo $, usando punto como separador decimal). null si no se distingue.
- litros: la cantidad de litros cargados, como número. null si no se distingue.
- proveedor: el nombre de la estación de servicio o razón social que emitió el ticket. null si no se distingue.
Respondé ÚNICAMENTE con un JSON: {"monto": number|null, "litros": number|null, "proveedor": string|null}`;

/**
 * Mismo criterio que lib/email.ts: sin OPENAI_API_KEY configurada, no hace
 * nada (el chofer completa el ticket a mano, como siempre) — nunca tira
 * excepción. Con la variable seteada, llama a la API REST de OpenAI
 * (chat completions con imagen) sin agregar su SDK como dependencia. El
 * resultado es siempre una sugerencia editable, nunca se guarda tal cual.
 */
export async function leerTicketCombustible(file: File): Promise<LecturaTicketResultado> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[OCR ticket combustible] (proveedor no configurado) el chofer completa el ticket a mano.");
    return { leido: false, motivo: "proveedor_no_configurado" };
  }

  if (!file.type.startsWith("image/")) {
    return { leido: false, motivo: "archivo_invalido" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const cuerpo = await res.text();
      console.error(`[OCR ticket combustible] OpenAI respondió ${res.status}: ${cuerpo}`);
      return { leido: false, motivo: "error_proveedor" };
    }

    const json = await res.json();
    const contenido = json.choices?.[0]?.message?.content;
    if (typeof contenido !== "string") {
      console.error("[OCR ticket combustible] respuesta sin contenido de texto.");
      return { leido: false, motivo: "error_proveedor" };
    }

    const datos = JSON.parse(contenido);
    return {
      leido: true,
      datos: {
        monto: typeof datos.monto === "number" ? datos.monto : null,
        litros: typeof datos.litros === "number" ? datos.litros : null,
        proveedor: typeof datos.proveedor === "string" ? datos.proveedor : null,
      },
    };
  } catch (err) {
    console.error("[OCR ticket combustible] error al leer el ticket:", err);
    return { leido: false, motivo: "error_proveedor" };
  }
}
