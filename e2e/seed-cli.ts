// Se ejecuta con `tsx` (no con el mismo loader que usa Playwright para su
// config) porque el cliente de Prisma generado usa import.meta, que el
// transform de Playwright para globalSetup/globalTeardown no soporta.
import "dotenv/config";
import fs from "fs";
import { seedE2E, teardownE2E, disconnectE2E } from "./seed";

const FIXTURE_PATH = process.argv[3];

async function main() {
  const modo = process.argv[2];
  if (modo === "setup") {
    const fixture = await seedE2E();
    fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
  } else if (modo === "teardown") {
    if (fs.existsSync(FIXTURE_PATH)) {
      const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
      await teardownE2E(fixture.empresaId);
      fs.unlinkSync(FIXTURE_PATH);
    }
  } else {
    throw new Error(`Modo desconocido: ${modo}`);
  }
  await disconnectE2E();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
