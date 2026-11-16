import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "climo-integration-"));
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "climo",
  password: "integration_only",
  port: 55432,
  persistent: false,
  postgresFlags: ["-k", "", "-h", "127.0.0.1"],
  onLog: (s) => {
    if (s.includes("FATAL")) console.error(s);
  },
  onError: console.error,
});
let exitCode = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("climo_test");
  const env = {
    ...process.env,
    DATABASE_URL:
      "postgresql://climo:integration_only@127.0.0.1:55432/climo_test?schema=public",
    SEED_PASSWORD: "ClimoIntegration2026!",
    NODE_ENV: "test",
  };
  for (const args of [
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      "packages/database/prisma/schema.prisma",
    ],
    ["--import", "tsx", "packages/database/seed.ts"],
    ["--import", "tsx", "--test", "tests/integration/api.test.ts"],
  ]) {
    const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
    if (result.status !== 0) throw new Error("Integration command failed");
  }
  exitCode = 0;
} catch (e) {
  console.error(e);
} finally {
  await pg.stop();
  await rm(dir, { recursive: true, force: true });
}
process.exitCode = exitCode;
