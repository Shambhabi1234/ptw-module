import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditDraft } from "@/lib/permissions";
import { validateTypeFields } from "@/lib/permitTypes";
import { writeAudit } from "@/lib/audit";
import { getFullPermit, permitNotFound } from "@/lib/permitService";
import { sweepExpiredPermits } from "@/lib/expiry";
import { findConflicts } from "@/lib/conflicts";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  await sweepExpiredPermits();

  const permit = await getFullPermit(id);
  if (!permit) return permitNotFound();

  const conflicts = await findConflicts({
    excludePermitId: permit.id,
    areaId: permit.areaId,
    type: permit.type,
    plannedStart: permit.plannedStart,
    plannedEnd: permit.plannedEnd,
  });

  return NextResponse.json({ permit, conflicts });
}

const editSchema = z.object({
  contractorName: z.string().min(1).optional(),
  workDescription: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  equipmentId: z.string().optional().nullable(),
  plannedStart: z.string().datetime().optional(),
  plannedEnd: z.string().datetime().optional(),
  hazards: z.array(z.string()).optional(),
  ppeRequired: z.array(z.string()).optional(),
  precautions: z.array(z.object({ label: z.string(), checked: z.boolean() })).optional(),
  typeFields: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Edits are only allowed while a permit is still a DRAFT. Once submitted,
 * the spec treats "field edit after submission" as something that itself
 * must be audit-logged — so rather than support silent edits mid-flight,
 * post-submission changes go through cancel + re-raise, which keeps the
 * audit trail honest. This is a decision made where the spec was silent
 * (documented in the README).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.permit.findUnique({ where: { id } });
  if (!existing) return permitNotFound();

  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Only a DRAFT permit can be edited." }, { status: 409 });
  }
  if (!canEditDraft(user, existing)) {
    return NextResponse.json({ error: "You cannot edit this permit." }, { status: 403 });
  }

  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data.", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.typeFields) {
    const check = validateTypeFields(existing.type, data.typeFields);
    if (!check.success) {
      return NextResponse.json(
        { error: "Invalid type-specific fields.", details: check.error.flatten() },
        { status: 400 }
      );
    }
    data.typeFields = check.data;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.permit.update({
      where: { id },
      data: {
        ...data,
        plannedStart: data.plannedStart ? new Date(data.plannedStart) : undefined,
        plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : undefined,
        typeFields: data.typeFields as any,
      },
    });
    await writeAudit(tx, {
      permitId: id,
      actorId: user.id,
      action: "FIELD_EDIT",
      comment: `Draft edited: ${Object.keys(data).join(", ")}`,
    });
    return p;
  });

  return NextResponse.json({ permit: updated });
}
