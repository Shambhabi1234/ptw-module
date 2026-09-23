import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canActOnApproval } from "@/lib/permissions";
import { transition } from "@/lib/stateMachine";
import { writeAudit } from "@/lib/audit";
import { permitNotFound, getFullPermit, allApproversApproved } from "@/lib/permitService";

const bodySchema = z.object({
  approvalRole: z.enum(["AREA_OWNER", "SAFETY_OFFICER"]),
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { approvalRole, decision, comment } = parsed.data;

  if (decision === "REJECT" && !comment?.trim()) {
    return NextResponse.json({ error: "A reason is required to reject a permit." }, { status: 400 });
  }

  const permit = await prisma.permit.findUnique({ where: { id }, include: { approvals: true } });
  if (!permit) return permitNotFound();

  if (permit.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "This permit is not awaiting approval." }, { status: 409 });
  }

  // Non-negotiable rule, checked first and always: nobody approves their
  // own permit, and only the right role/area can act on the right slot.
  const permCheck = canActOnApproval(user, permit, approvalRole);
  if (!permCheck.allowed) {
    return NextResponse.json({ error: permCheck.reason }, { status: 403 });
  }

  const approvalRow = permit.approvals.find((a) => a.approverRole === approvalRole);
  if (!approvalRow) {
    return NextResponse.json({ error: "No such approval slot on this permit." }, { status: 500 });
  }
  if (approvalRow.status !== "PENDING") {
    return NextResponse.json({ error: "This approval has already been decided." }, { status: 409 });
  }

  if (decision === "REJECT") {
    const result = transition({
      status: permit.status,
      action: "REJECT",
      now: new Date(),
      plannedStart: permit.plannedStart,
      plannedEnd: permit.plannedEnd,
      allApproversApproved: false,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.permitApproval.update({
        where: { id: approvalRow.id },
        data: { status: "REJECTED", approverId: user.id, comment, decidedAt: new Date() },
      });
      await tx.permit.update({ where: { id }, data: { status: result.nextStatus! } });
      await writeAudit(tx, {
        permitId: id,
        actorId: user.id,
        action: "REJECTION",
        fromValue: permit.status,
        toValue: result.nextStatus!,
        comment: comment ?? null,
      });
    });

    const updated = await getFullPermit(id);
    return NextResponse.json({ permit: updated });
  }

  // APPROVE: record this approver's decision, then check whether every
  // required approval is now in, and only then promote the permit itself.
  const updatedApprovals = permit.approvals.map((a) =>
    a.id === approvalRow.id ? { ...a, status: "APPROVED" as const } : a
  );
  const everyoneApproved = allApproversApproved({ approvals: updatedApprovals });

  const result = transition({
    status: permit.status,
    action: "APPROVE",
    now: new Date(),
    plannedStart: permit.plannedStart,
    plannedEnd: permit.plannedEnd,
    allApproversApproved: everyoneApproved,
  });

  await prisma.$transaction(async (tx) => {
    await tx.permitApproval.update({
      where: { id: approvalRow.id },
      data: { status: "APPROVED", approverId: user.id, comment, decidedAt: new Date() },
    });

    await writeAudit(tx, {
      permitId: id,
      actorId: user.id,
      action: "APPROVAL",
      toValue: `${approvalRole}: APPROVED`,
      comment: comment ?? null,
    });

    if (everyoneApproved && result.ok) {
      await tx.permit.update({ where: { id }, data: { status: result.nextStatus! } });
      await writeAudit(tx, {
        permitId: id,
        actorId: user.id,
        action: "STATUS_CHANGE",
        fromValue: permit.status,
        toValue: result.nextStatus!,
        comment: "All required approvals received.",
      });
    }
  });

  const updated = await getFullPermit(id);
  return NextResponse.json({ permit: updated });
}
