import "server-only";

export type TicketCombustibleDetectado = {
  monto: number | null;
  litros: number | null;
  proveedor: string | null;
  kmOdometro: number | null;
};

export type LecturaTicketResultado =
  | { leido: true; datos: TicketCombustibleDetectado }
  | { leido: false; motivo: "proveedor_no_configurado" | "error_proveedor" | "archivo_invalido" };

const PROMPT = `Sos un asistente que lee tickets o facturas de carga de combustible en estaciones de servicio. Suelen tener una tabla con columnas como "PRODUCTO / CANTIDAD / PRECIO / IMPORTE" (los nombres exactos varían). A partir de la imagen, extraé:
- monto: el importe TOTAL pagado — el número final de la fila (a veces rotulado "IMPORTE" o "TOTAL"), no el precio unitario. Como número, sin el símbolo $, usando punto como separador decimal. null si no se distingue.
- litros: la CANTIDAD de litros cargados. Ojo: en la misma fila hay dos números fáciles de confundir — la cantidad de litros (columna "CANTIDAD", junto a la unidad "Litr"/"Lts"/"L") y el precio por litro (columna "PRECIO"). PISTA CLAVE para no confundirlos: los surtidores miden el volumen con TRES decimales (ej: 39.526), mientras que los montos en dinero — precio por litro e importe — casi siempre se escriben con DOS decimales (ej: 12.65, 500.00). Si de los dos números uno tiene tres decimales y el otro dos, el de tres decimales son los litros, no el de dos. Como número. null si no se distingue.
- proveedor: el nombre de la estación de servicio o razón social que emitió el ticket. null si no se distingue.
- kmOdometro: el kilometraje del odómetro del vehículo, SOLO si el ticket lo tiene escrito (impreso o a mano) — muchas estaciones lo anotan como "KM", "ODOMETRO" o "KILOMETRAJE". Es un número entero de varios dígitos (miles a cientos de miles), muy distinto en magnitud a los litros o al monto — no lo confundas con esos. Si el ticket no muestra ningún dato de kilometraje, respondé null: no lo inventes ni lo adivines a partir de otro número de la imagen.
Respondé ÚNICAMENTE con un JSON: {"monto": number|null, "litros": number|null, "proveedor": string|null, "kmOdometro": number|null}`;

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

  // La API de OpenAI solo acepta png/jpeg/gif/webp — un HEIC (típico de iPhone,
  // si el navegador no lo convirtió antes de subirlo) pasaría el chequeo de
  // "empieza con image/" pero OpenAI lo rechazaría igual; lo cortamos acá con
  // un motivo específico en vez de dejar que falle como error_proveedor.
  const FORMATOS_SOPORTADOS = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  if (!FORMATOS_SOPORTADOS.includes(file.type)) {
    console.log(`[OCR ticket combustible] formato no soportado: ${file.type || "(sin type)"}.`);
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
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: dataUri, detail: "high" } },
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
        kmOdometro: typeof datos.kmOdometro === "number" ? datos.kmOdometro : null,
      },
    };
  } catch (err) {
    console.error("[OCR ticket combustible] error al leer el ticket:", err);
    return { leido: false, motivo: "error_proveedor" };
  }
}
