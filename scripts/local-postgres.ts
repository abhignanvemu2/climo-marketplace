import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const pg = new EmbeddedPostgres({
  databaseDir: ".local-postgres",
  user: "climo",
  password: "climo_local",
  port: 5432,
  persistent: true,
  postgresFlags: ["-k", "", "-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync(".local-postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const found = await client.query(
  "SELECT 1 FROM pg_database WHERE datname='climo'",
);
await client.end();
if (!found.rows.length) await pg.createDatabase("climo");
console.log(
  "Local PostgreSQL ready on localhost:5432. Development only. Keep this process running.",
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
await new Promise(() => {});
