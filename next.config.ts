import type { NextConfig } from "next";

// Todo lo que sirve la app (imágenes/archivos vía /api/archivos/[id], fuentes
// de next/font/google autohospedadas, el service worker de push en /sw.js)
// es same-origin — no hace falta ningún dominio externo en la CSP. Sin
// nonce/proxy (ver docs de Next) para no forzar renderizado dinámico en
// todas las páginas; por eso 'unsafe-inline' en script/style, que sigue
// bloqueando la inyección de scripts/estilos desde otros orígenes.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "worker-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    // Solo en producción: en dev, Next/React inyectan overlays de error y
    // HMR que una CSP estricta rompe, y no hay nada que proteger en local.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
