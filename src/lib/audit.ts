import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * Writes one immutable audit entry. This is the ONLY way audit rows get
 * created in the app — every mutating API route calls this, always inside
 * the same transaction as the state change it's recording, so the audit
 * trail can never drift from what actually happened.
 */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  params: {
    permitId: string;
    actorId: string | null;
    action: string;
    fromValue?: string | null;
    toValue?: string | null;
    comment?: string | null;
  }
) {
  return tx.auditLog.create({
    data: {
      permitId: params.permitId,
      actorId: params.actorId,
      action: params.action,
      fromValue: params.fromValue ?? null,
      toValue: params.toValue ?? null,
      comment: params.comment ?? null,
    },
  });
}

const TYPE_PREFIX: Record<string, string> = {
  HOT_WORK: "HW",
  CONFINED_SPACE: "CS",
  WORKING_AT_HEIGHT: "WH",
  ELECTRICAL_ISOLATION: "EL",
};

/** e.g. PTW-HW-2026-000142 */
export async function generatePermitCode(type: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = TYPE_PREFIX[type] ?? "GN";
  const count = await prisma.permit.count();
  const seq = String(count + 1).padStart(6, "0");
  return `PTW-${prefix}-${year}-${seq}`;
}
