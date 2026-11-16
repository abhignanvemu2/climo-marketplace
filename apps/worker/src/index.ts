import "dotenv/config";
import { expireReservations } from "../../api/src/commerce.js";
import { buildSettlements } from "../../api/src/operations.js";
let stopping = false;
async function tick() {
  try {
    await expireReservations();
    const india = new Date(Date.now() + 330 * 60000);
    if (india.getUTCDay() === 1 && india.getUTCHours() === 10)
      await buildSettlements("weekly-worker");
  } catch (e) {
    console.error(
      "Worker task failed",
      e instanceof Error ? e.message : "unknown",
    );
  } finally {
    if (!stopping) setTimeout(tick, 30000);
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    process.exit(0);
  });
console.log("Climo worker started");
await tick();
