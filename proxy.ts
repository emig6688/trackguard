import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { homeForRol } from "@/lib/rutas-por-rol";

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));
  const session = req.auth;

  if (!session?.user) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isPublic) {
    return NextResponse.redirect(new URL(homeForRol(session.user.rol), nextUrl));
  }

  if (nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(homeForRol(session.user.rol), nextUrl));
  }

  const esRutaMobile = nextUrl.pathname.startsWith("/mobile");
  if (session.user.rol === "CHOFER" && !esRutaMobile) {
    return NextResponse.redirect(new URL("/mobile/inicio", nextUrl));
  }

  const esRutaGuardia = nextUrl.pathname.startsWith("/guardia");
  if (session.user.rol === "GUARDIA" && !esRutaGuardia) {
    return NextResponse.redirect(new URL("/guardia", nextUrl));
  }
  // ADMIN y GERENTE también pueden entrar a /guardia (ven lo mismo que el
  // guardia sin loguearse con ese usuario — ver lib/permisos.ts ROLES_GUARDIA),
  // sin quedar forzados ahí como el propio guardia.
  const puedeVerGuardia = ["GUARDIA", "ADMIN", "GERENTE"].includes(session.user.rol);
  if (!puedeVerGuardia && esRutaGuardia) {
    return NextResponse.redirect(new URL(homeForRol(session.user.rol), nextUrl));
  }

  const esRutaPlataforma = nextUrl.pathname.startsWith("/plataforma");
  if (session.user.rol === "SUPERADMIN" && !esRutaPlataforma) {
    return NextResponse.redirect(new URL("/plataforma", nextUrl));
  }
  if (session.user.rol !== "SUPERADMIN" && esRutaPlataforma) {
    return NextResponse.redirect(new URL(homeForRol(session.user.rol), nextUrl));
  }

  if (nextUrl.pathname.startsWith("/usuarios") && session.user.rol !== "ADMIN") {
    return NextResponse.redirect(new URL(homeForRol(session.user.rol), nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
