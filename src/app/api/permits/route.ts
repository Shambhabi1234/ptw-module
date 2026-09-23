import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCreatePermit } from "@/lib/permissions";
import { validateTypeFields, getPermitTypeDef } from "@/lib/permitTypes";
import { generatePermitCode } from "@/lib/audit";
import { sweepExpiredPermits } from "@/lib/expiry";
import { findConflicts } from "@/lib/conflicts";

const PERMIT_TYPES = ["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL_ISOLATION"] as const;

const createSchema = z.object({
  type: z.enum(PERMIT_TYPES),
  contractorName: z.string().min(1),
  workDescription: z.string().min(1),
  plantId: z.string().min(1),
  areaId: z.string().min(1),
  equipmentId: z.string().optional().nullable(),
  plannedStart: z.string().datetime(),
  plannedEnd: z.string().datetime(),
  hazards: z.array(z.string()).default([]),
  ppeRequired: z.array(z.string()).default([]),
  precautions: z.array(z.object({ label: z.string(), checked: z.boolean() })).optional(),
  typeFields: z.record(z.string(), z.unknown()),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Lazy expiry sweep — see lib/expiry.ts. Cheap, keeps every list view fresh.
  await sweepExpiredPermits();

  const url = req.nextUrl;
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const areaId = url.searchParams.get("areaId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const mineApprovals = url.searchParams.get("myApprovals") === "true";
  const expiringSoon = url.searchParams.get("expiringSoon") === "true";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (areaId) where.areaId = areaId;
  if (from || to) {
    where.plannedStart = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  if (expiringSoon) {
    const now = new Date();
    const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    where.status = { in: ["ACTIVE"] };
    where.plannedEnd = { gte: now, lte: soon };
  }

  if (mineApprovals) {
    if (user.role === "AREA_OWNER") {
      where.status = "PENDING_APPROVAL";
      where.areaId = { in: user.ownedAreaIds };
      where.requesterId = { not: user.id };
      where.approvals = {
        some: { approverRole: "AREA_OWNER", status: "PENDING" },
      };
    } else if (user.role === "SAFETY_OFFICER") {
      where.status = "PENDING_APPROVAL";
      where.requesterId = { not: user.id };
      where.approvals = {
        some: { approverRole: "SAFETY_OFFICER", status: "PENDING" },
      };
    } else if (user.role !== "ADMIN") {
      // Requesters have nothing to approve.
      return NextResponse.json({ permits: [] });
    }
  }

  const permits = await prisma.permit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { id: true, name: true } },
      plant: { select: { id: true, name: true } },
      area: { select: { id: true, name: true, ownerId: true } },
      equipment: { select: { id: true, tag: true, name: true } },
      approvals: true,
    },
    take: 200,
  });

  return NextResponse.json({ permits });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!canCreatePermit(user)) {
    return NextResponse.json({ error: "Only a requester can create a permit." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid permit data.", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (new Date(data.plannedEnd) <= new Date(data.plannedStart)) {
    return NextResponse.json({ error: "Planned end must be after planned start." }, { status: 400 });
  }

  const typeCheck = validateTypeFields(data.type, data.typeFields);
  if (!typeCheck.success) {
    return NextResponse.json(
      { error: "Invalid type-specific fields.", details: typeCheck.error.flatten() },
      { status: 400 }
    );
  }

  const typeDef = getPermitTypeDef(data.type);
  const precautions =
    data.precautions ?? typeDef.defaultPrecautions.map((label) => ({ label, checked: false }));

  const code = await generatePermitCode(data.type);

  const permit = await prisma.permit.create({
    data: {
      code,
      type: data.type,
      status: "DRAFT",
      requesterId: user.id,
      contractorName: data.contractorName,
      workDescription: data.workDescription,
      plantId: data.plantId,
      areaId: data.areaId,
      equipmentId: data.equipmentId || null,
      plannedStart: new Date(data.plannedStart),
      plannedEnd: new Date(data.plannedEnd),
      hazards: data.hazards,
      ppeRequired: data.ppeRequired,
      precautions,
      typeFields: typeCheck.data,
    },
  });

  const conflicts = await findConflicts({
    excludePermitId: permit.id,
    areaId: permit.areaId,
    type: permit.type,
    plannedStart: permit.plannedStart,
    plannedEnd: permit.plannedEnd,
  });

  return NextResponse.json({ permit, conflicts });
}
