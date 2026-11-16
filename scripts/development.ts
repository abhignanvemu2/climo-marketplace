import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
let pg: EmbeddedPostgres | undefined;
if (process.env.CLIMO_EMBEDDED_DB === "true") {
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "Embedded development database is not allowed in production",
    );
  pg = new EmbeddedPostgres({
    databaseDir: ".dev-postgres",
    user: "climo",
    password: "climo_local",
    port: 5432,
    persistent: true,
    postgresFlags: ["-k", "", "-h", "127.0.0.1"],
    onLog: () => {},
    onError: console.error,
  });
  if (!existsSync(".dev-postgres/PG_VERSION")) await pg.initialise();
  await pg.start();
  const c = pg.getPgClient();
  await c.connect();
  const found = await c.query(
    "SELECT 1 FROM pg_database WHERE datname='climo'",
  );
  await c.end();
  if (!found.rows.length) await pg.createDatabase("climo");
  process.env.DATABASE_URL =
    "postgresql://climo:climo_local@127.0.0.1:5432/climo?schema=public";
  for (const args of [
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      "packages/database/prisma/schema.prisma",
    ],
    ...(process.env.SEED_PASSWORD
      ? [["--import", "tsx", "packages/database/seed.ts"]]
      : []),
  ]) {
    const r = spawnSync(process.execPath, args, {
      stdio: "inherit",
      env: process.env,
    });
    if (r.status !== 0) throw new Error("Database setup failed");
  }
}
const commands = [
  ["--import", "tsx", "--watch", "apps/api/src/server.ts"],
  ["--import", "tsx", "apps/worker/src/index.ts"],
  [
    "node_modules/vite/bin/vite.js",
    "apps/customer-web",
    "--host",
    "0.0.0.0",
    "--port",
    "5173",
  ],
  [
    "node_modules/vite/bin/vite.js",
    "apps/seller-portal",
    "--host",
    "0.0.0.0",
    "--port",
    "5174",
  ],
  [
    "node_modules/vite/bin/vite.js",
    "apps/admin-portal",
    "--host",
    "0.0.0.0",
    "--port",
    "5175",
  ],
];
const children = commands.map((args) =>
  spawn(process.execPath, args, { stdio: "inherit", env: process.env }),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  if (pg) await pg.stop();
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
children.forEach((child) =>
  child.on("exit", (code) => {
    if (!stopping && code !== 0) {
      console.error("Development process stopped unexpectedly");
      void stop();
    }
  }),
);
