// Vercel corre las funciones en UTC — toLocaleTimeString/toLocaleString sin un
// timeZone explícito usan el huso del runtime, no el de la empresa (todas en
// Argentina), así que un registro de las 20:30 ART aparecía como "23:30" en
// vez de la hora real. Los dos helpers de acá son la forma correcta de
// mostrar una hora real (fechaHora, createdAt): siempre con este huso fijo,
// sin importar dónde corra el servidor.
//
// Ojo: esto NO aplica a campos que son una fecha de calendario elegida con
// <input type="date"> (fechaLimite, fechaVencimiento, etc.) — esos se guardan
// como medianoche UTC del día elegido y deben mostrarse tal cual (con
// toLocaleDateString sin este huso), porque convertirlos a ART los corre un
// día para atrás.
const TIMEZONE_ARGENTINA = "America/Argentina/Buenos_Aires";

export function formatearHora(fecha: Date): string {
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE_ARGENTINA });
}

export function formatearFechaHora(fecha: Date): string {
  return fecha.toLocaleString("es-AR", { timeZone: TIMEZONE_ARGENTINA });
}
