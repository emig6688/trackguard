import type { Rol } from "@/app/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: Rol;
      nombre: string;
      email: string;
      empresaId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
    nombre: string;
    empresaId: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
    nombre: string;
    empresaId: string | null;
  }
}
