import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canRequestExtension, canDecideExtension } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { getFullPermit, permitNotFound } from "@/lib/permitService";

const MAX_EXTENSION_HOURS = 8;
const MAX_EXTENSIONS_PER_PERMIT = 2;

const requestSchema = z.object({
  hours: z.number().int().positive().max(MAX_EXTENSION_HOURS),
  reason: z.string().min(1),
});

/** A requester asks for +N hours before expiry. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const permit = await prisma.permit.findUnique({
    where: { id },
    include: { extensionRequests: true },
  });
  if (!permit) return permitNotFound();

  if (!canRequestExtension(user, permit)) {
    return NextResponse.json({ error: "You cannot request an extension on this permit." }, { status: 403 });
  }
  if (permit.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only an ACTIVE permit can be extended." }, { status: 409 });
  }

  const approvedCount = permit.extensionRequests.filter((e) => e.status === "APPROVED").length;
  if (approvedCount >= MAX_EXTENSIONS_PER_PERMIT) {
    return NextResponse.json(
      { error: `This permit has already used the maximum of ${MAX_EXTENSIONS_PER_PERMIT} extensions. Raise a new permit instead.` },
      { status: 409 }
    );
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid extension request.", details: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.extensionRequest.create({
      data: { permitId: id, hours: parsed.data.hours, reason: parsed.data.reason, status: "PENDING" },
    });
    await writeAudit(tx, {
      permitId: id,
      actorId: user.id,
      action: "EXTENSION_REQUESTED",
      comment: `Requested +${parsed.data.hours}h: ${parsed.data.reason}`,
    });
  });

  const updated = await getFullPermit(id);
  return NextResponse.json({ permit: updated });
}

const decideSchema = z.object({
  extensionRequestId: z.string(),
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().optional(),
});

/** Safety Officer approves/rejects a pending extension request. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!canDecideExtension(user)) {
    return NextResponse.json({ error: "Only a Safety Officer can decide an extension request." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = decideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const extReq = await prisma.extensionRequest.findUnique({ where: { id: parsed.data.extensionRequestId } });
  if (!extReq || extReq.permitId !== id) {
    return NextResponse.json({ error: "Extension request not found." }, { status: 404 });
  }
  if (extReq.status !== "PENDING") {
    return NextResponse.json({ error: "This extension request has already been decided." }, { status: 409 });
  }

  const permit = await prisma.permit.findUniqueOrThrow({ where: { id } });
  if (permit.status !== "ACTIVE") {
    return NextResponse.json({ error: "Permit is no longer ACTIVE; extension can't be applied." }, { status: 409 });
  }

  const approved = parsed.data.decision === "APPROVE";

  await prisma.$transaction(async (tx) => {
    await tx.extensionRequest.update({
      where: { id: extReq.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        reviewerId: user.id,
        reviewComment: parsed.data.comment,
        decidedAt: new Date(),
      },
    });

    if (approved) {
      const newEnd = new Date(permit.plannedEnd.getTime() + extReq.hours * 60 * 60 * 1000);
      await tx.permit.update({ where: { id }, data: { plannedEnd: newEnd } });
    }

    await writeAudit(tx, {
      permitId: id,
      actorId: user.id,
      action: approved ? "EXTENSION_APPROVED" : "EXTENSION_REJECTED",
      toValue: approved ? `+${extReq.hours}h` : undefined,
      comment: parsed.data.comment ?? null,
    });
  });

  const updated = await getFullPermit(id);
  return NextResponse.json({ permit: updated });
}
