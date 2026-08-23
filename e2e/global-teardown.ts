import path from "path";
import { execSync } from "child_process";
import { FIXTURE_PATH } from "./global-setup";

export default function globalTeardown() {
  execSync(`npx tsx "${path.join(__dirname, "seed-cli.ts")}" teardown "${FIXTURE_PATH}"`, {
    stdio: "inherit",
  });
}
