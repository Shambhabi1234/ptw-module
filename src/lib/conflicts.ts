import { prisma } from "./db";
import type { PermitType } from "@prisma/client";

/**
 * A real cause of plant accidents: hot work (open flame / spark) authorized
 * in the same area at the same time as a confined space entry (which may
 * still hold flammable vapour, or where smoke/gas from the hot work can
 * drift into the confined space). We warn — we don't block — because there
 * are legitimate cases (different equipment, compensating controls) where
 * a human needs to make the final call, not the software.
 */
const CONFLICTING_TYPE_PAIRS: Array<[PermitType, PermitType]> = [
  ["HOT_WORK", "CONFINED_SPACE"],
];

function typesConflict(a: PermitType, b: PermitType): boolean {
  return CONFLICTING_TYPE_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a)
  );
}

export interface ConflictWarning {
  permitId: string;
  code: string;
  type: PermitType;
  status: string;
  plannedStart: Date;
  plannedEnd: Date;
}

/**
 * Finds other non-terminal permits in the same area whose time window
 * overlaps this one and whose type is a known conflicting pair.
 */
export async function findConflicts(params: {
  excludePermitId?: string;
  areaId: string;
  type: PermitType;
  plannedStart: Date;
  plannedEnd: Date;
}): Promise<ConflictWarning[]> {
  const candidates = await prisma.permit.findMany({
    where: {
      areaId: params.areaId,
      id: params.excludePermitId ? { not: params.excludePermitId } : undefined,
      status: { notIn: ["REJECTED", "EXPIRED", "CANCELLED", "CLOSED_VERIFIED"] },
      plannedStart: { lt: params.plannedEnd },
      plannedEnd: { gt: params.plannedStart },
    },
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      plannedStart: true,
      plannedEnd: true,
    },
  });

  return candidates
    .filter((c) => typesConflict(c.type, params.type))
    .map((c) => ({
      permitId: c.id,
      code: c.code,
      type: c.type,
      status: c.status,
      plannedStart: c.plannedStart,
      plannedEnd: c.plannedEnd,
    }));
}
