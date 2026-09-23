import { prisma } from "./db";
import { transition, type Action } from "./stateMachine";
import { writeAudit } from "./audit";
import { getFullPermit } from "./permitService";
import type { AuthUser } from "./permissions";

export interface SimpleActionResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

export async function performSimpleTransition(params: {
  permitId: string;
  user: AuthUser;
  action: Action;
  checkPermission: (permit: { requesterId: string; areaId: string; status: string }) => boolean;
  permissionDeniedMessage: string;
  comment: string;
  extraData?: Record<string, unknown>;
}): Promise<SimpleActionResult> {
  const permit = await prisma.permit.findUnique({ where: { id: params.permitId } });
  if (!permit) {
    return { ok: false, status: 404, body: { error: "Permit not found." } };
  }

  if (!params.checkPermission(permit)) {
    return { ok: false, status: 403, body: { error: params.permissionDeniedMessage } };
  }

  const result = transition({
    status: permit.status,
    action: params.action,
    now: new Date(),
    plannedStart: permit.plannedStart,
    plannedEnd: permit.plannedEnd,
    allApproversApproved: true, // not relevant to these actions
  });

  if (!result.ok) {
    return { ok: false, status: 409, body: { error: result.error } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.permit.update({
      where: { id: params.permitId },
      data: { status: result.nextStatus!, ...(params.extraData ?? {}) },
    });
    await writeAudit(tx, {
      permitId: params.permitId,
      actorId: params.user.id,
      action: "STATUS_CHANGE",
      fromValue: permit.status,
      toValue: result.nextStatus!,
      comment: params.comment,
    });
  });

  const updated = await getFullPermit(params.permitId);
  return { ok: true, status: 200, body: { permit: updated } };
}
