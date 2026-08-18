import fs from "fs";
const envContent = fs.readFileSync(".env", "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
import("./app/generated/prisma/client/index.js").then(async ({ PrismaClient }) => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const usuarios = await prisma.usuario.findMany({ select: { email: true, rol: true, nombre: true } });
  console.log(JSON.stringify(usuarios, null, 2));
  await prisma.$disconnect();
});
