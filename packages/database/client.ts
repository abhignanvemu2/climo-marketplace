import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
export const db = new PrismaClient();
export async function transaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let i = 0; ; i++)
    try {
      return await db.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034" &&
        i < 4
      )
        continue;
      throw e;
    }
}
export async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  targetId: string,
  data: Prisma.InputJsonValue = {},
) {
  return tx.auditEvent.create({ data: { actorId, action, targetId, data } });
}
