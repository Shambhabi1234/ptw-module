import { prisma } from "./db";
import { transition } from "./stateMachine";
import { writeAudit } from "./audit";

/**
 * Honest answer to "how does expiry work when nobody has the browser
 * open": a client-side countdown timer does NOT expire a permit — it just
 * shows a number. The actual expiry is this function, which:
 *
 *  1. Runs lazily, inline, at the top of every permit list/detail read
 *     (cheap: one indexed query), so the UI is never more than one request
 *     stale even if nothing else ever calls it.
 *  2. Is also exposed as POST /api/cron/expire so a real scheduler (a
 *     Vercel Cron Job, or `curl` from any external scheduler) can hit it
 *     every few minutes in production, which is what you'd actually wire
 *     up so permits expire even during a quiet hour with zero traffic.
 *
 * Both call sites hit the exact same function, so there's one definition
 * of "expired" in the whole system.
 */
export async function sweepExpiredPermits(): Promise<{ expiredCount: number }> {
  const now = new Date();

  const candidates = await prisma.permit.findMany({
    where: {
      status: { in: ["APPROVED", "ACTIVE", "SUSPENDED"] },
      plannedEnd: { lt: now },
    },
    select: { id: true, status: true, plannedEnd: true, plannedStart: true },
  });

  let expiredCount = 0;

  for (const permit of candidates) {
    const result = transition({
      status: permit.status,
      action: "EXPIRE",
      now,
      plannedStart: permit.plannedStart,
      plannedEnd: permit.plannedEnd,
      allApproversApproved: true, // irrelevant for EXPIRE
    });

    if (!result.ok || !result.nextStatus) continue;

    await prisma.$transaction(async (tx) => {
      await tx.permit.update({
        where: { id: permit.id },
        data: { status: result.nextStatus! },
      });
      await writeAudit(tx, {
        permitId: permit.id,
        actorId: null, // system action, no human actor
        action: "STATUS_CHANGE",
        fromValue: permit.status,
        toValue: result.nextStatus!,
        comment: "Auto-expired: planned end time passed without closure.",
      });
    });

    expiredCount += 1;
  }

  return { expiredCount };
}
