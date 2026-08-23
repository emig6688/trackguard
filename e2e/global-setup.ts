import path from "path";
import { execSync } from "child_process";

export const FIXTURE_PATH = path.join(__dirname, ".fixture.json");

export default function globalSetup() {
  execSync(`npx tsx "${path.join(__dirname, "seed-cli.ts")}" setup "${FIXTURE_PATH}"`, {
    stdio: "inherit",
  });
}
