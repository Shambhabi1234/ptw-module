import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canSubmit } from "@/lib/permissions";
import { transition } from "@/lib/stateMachine";
import { writeAudit } from "@/lib/audit";
import { permitNotFound, getFullPermit } from "@/lib/permitService";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const permit = await prisma.permit.findUnique({ where: { id } });
  if (!permit) return permitNotFound();

  if (!canSubmit(user, permit)) {
    return NextResponse.json({ error: "You cannot submit this permit." }, { status: 403 });
  }

  const result = transition({
    status: permit.status,
    action: "SUBMIT",
    now: new Date(),
    plannedStart: permit.plannedStart,
    plannedEnd: permit.plannedEnd,
    allApproversApproved: false,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.permit.update({ where: { id }, data: { status: result.nextStatus! } });

    // Required approvers: the owner of this permit's area, and any safety
    // officer. approverId is left null until someone actually acts — that
    // way any safety officer can claim the safety slot, but only the
    // specific area owner can act on the area slot (enforced in
    // permissions.ts, not by pre-assigning a row).
    await tx.permitApproval.create({
      data: { permitId: id, approverRole: "AREA_OWNER", status: "PENDING" },
    });
    await tx.permitApproval.create({
      data: { permitId: id, approverRole: "SAFETY_OFFICER", status: "PENDING" },
    });

    await writeAudit(tx, {
      permitId: id,
      actorId: user.id,
      action: "STATUS_CHANGE",
      fromValue: permit.status,
      toValue: result.nextStatus!,
      comment: "Submitted for approval.",
    });
  });

  const updated = await getFullPermit(id);
  return NextResponse.json({ permit: updated });
}
