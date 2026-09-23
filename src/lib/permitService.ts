import { prisma } from "./db";
import { NextResponse } from "next/server";

export const PERMIT_INCLUDE = {
  requester: { select: { id: true, name: true, email: true } },
  plant: { select: { id: true, name: true } },
  area: { select: { id: true, name: true, ownerId: true, owner: { select: { id: true, name: true } } } },
  equipment: { select: { id: true, tag: true, name: true } },
  approvals: { include: { approver: { select: { id: true, name: true } } } },
  auditLog: { orderBy: { createdAt: "asc" as const }, include: { actor: { select: { id: true, name: true, role: true } } } },
  extensionRequests: { orderBy: { createdAt: "desc" as const }, include: { reviewer: { select: { id: true, name: true } } } },
} as const;

export type FullPermit = NonNullable<Awaited<ReturnType<typeof getFullPermit>>>;

export async function getFullPermit(id: string) {
  return prisma.permit.findUnique({ where: { id }, include: PERMIT_INCLUDE });
}

export function permitNotFound() {
  return NextResponse.json({ error: "Permit not found." }, { status: 404 });
}

export function allApproversApproved(permit: { approvals: { status: string }[] }): boolean {
  if (permit.approvals.length === 0) return false;
  return permit.approvals.every((a) => a.status === "APPROVED");
}
