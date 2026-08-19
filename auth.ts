import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizarDni } from "@/lib/zod-helpers";
import type { Rol } from "@/app/generated/prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        usuario: {},
        password: {},
      },
      authorize: async (credentials, request) => {
        const identificador = (credentials?.usuario as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!identificador || !password) return null;

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
        const registrarIntentoFallido = () => prisma.intentoLogin.create({ data: { identificador, ip } });

        // Bloqueo temporal por identificador+IP: no cuenta intentos fallidos
        // indefinidamente, solo los de la ventana reciente, así que un
        // usuario legítimo que se equivoca y después entra bien no queda
        // bloqueado por errores viejos.
        const VENTANA_MS = 15 * 60 * 1000;
        const MAX_INTENTOS = 6;
        const intentosRecientes = await prisma.intentoLogin.count({
          where: { identificador, ip, createdAt: { gte: new Date(Date.now() - VENTANA_MS) } },
        });
        if (intentosRecientes >= MAX_INTENTOS) return null;

        const usuario = await prisma.usuario.findFirst({
          where: { OR: [{ email: identificador }, { dni: normalizarDni(identificador) }] },
          include: { empresa: true },
        });
        if (!usuario || !usuario.activo) {
          await registrarIntentoFallido();
          return null;
        }
        if (usuario.rol !== "SUPERADMIN" && usuario.empresa?.activo !== true) {
          await registrarIntentoFallido();
          return null;
        }

        const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
        if (!passwordValida) {
          await registrarIntentoFallido();
          return null;
        }

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          rol: usuario.rol,
          empresaId: usuario.empresaId,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.rol = (user as { rol: Rol }).rol;
        token.nombre = user.name as string;
        token.empresaId = (user as { empresaId: string | null }).empresaId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.rol = token.rol;
      session.user.nombre = token.nombre;
      session.user.empresaId = token.empresaId;
      return session;
    },
  },
});
