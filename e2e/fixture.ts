import fs from "fs";
import type { FixtureE2E } from "./seed";
import { FIXTURE_PATH } from "./global-setup";

export function leerFixture(): FixtureE2E {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
}
