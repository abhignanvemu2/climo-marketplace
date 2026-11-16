import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, audit, transaction } from "../packages/database/client.js";
const d = z
  .object({
    email: z.email().transform((v) => v.toLowerCase()),
    role: z.enum(["ADMIN", "FINANCE"]),
    name: z.string().min(2),
    password: z.string().min(16),
  })
  .parse({
    email: process.env.PROVISION_EMAIL,
    role: process.env.PROVISION_ROLE,
    name: process.env.PROVISION_NAME,
    password: process.env.PROVISION_PASSWORD,
  });
const passwordHash = await bcrypt.hash(d.password, 12);
await transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: d.email, name: d.name, role: d.role, passwordHash },
  });
  await audit(
    tx,
    "deployment-operator",
    "PRIVILEGED_ACCOUNT_PROVISIONED",
    user.id,
    { role: d.role },
  );
});
console.log(
  "Privileged account provisioned. Clear provisioning environment variables.",
);
await db.$disconnect();
