"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { normalizarDni } from "@/lib/zod-helpers";
import { homeForRol } from "@/lib/rutas-por-rol";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const identificadorCrudo = (formData.get("usuario") as string | null)?.trim();

  try {
    // redirect: false en vez de dejar que signIn redirija solo a "/": así se
    // puede mandar directo a la home del rol acá mismo. Redirigir siempre a
    // "/" y confiar en que proxy.ts la corrija en un segundo salto no
    // actualizaba la barra de direcciones del navegador (el contenido
    // correcto se renderizaba igual, pero la URL visible quedaba en "/"
    // hasta el próximo refresh).
    await signIn("credentials", {
      usuario: identificadorCrudo,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Usuario o contraseña incorrectos." };
    }
    throw error;
  }

  // auth() no ve todavía la sesión recién creada dentro de esta misma
  // ejecución (el cookie de sesión queda en la respuesta que se está
  // armando, no en el request ya en curso) — se busca el rol a mano en vez
  // de depender de eso. La contraseña ya fue validada por signIn arriba;
  // esto solo repite la misma normalización de identificador que usa
  // authorize() en auth.ts para saber a dónde mandar al usuario.
  const identificador = identificadorCrudo!.includes("@")
    ? identificadorCrudo!.toLowerCase()
    : normalizarDni(identificadorCrudo!);
  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ email: identificador }, { dni: identificador }] },
    select: { rol: true },
  });

  redirect(homeForRol(usuario!.rol));
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
