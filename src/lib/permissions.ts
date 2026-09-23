import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  role: Role;
  ownedAreaIds: string[];
}

export interface PermitLike {
  requesterId: string;
  areaId: string;
  status: string;
}

/** Requester can only submit/close/edit-draft their OWN permits. */
export function canEditDraft(user: AuthUser, permit: PermitLike): boolean {
  if (user.role === "ADMIN") return true;
  return user.role === "REQUESTER" && user.id === permit.requesterId;
}

export function canSubmit(user: AuthUser, permit: PermitLike): boolean {
  return canEditDraft(user, permit);
}

export function canClose(user: AuthUser, permit: PermitLike): boolean {
  if (user.role === "ADMIN") return true;
  return user.role === "REQUESTER" && user.id === permit.requesterId;
}

export function canVerifyClosure(user: AuthUser): boolean {
  return user.role === "SAFETY_OFFICER" || user.role === "ADMIN";
}

export function canSuspend(user: AuthUser): boolean {
  return user.role === "SAFETY_OFFICER" || user.role === "ADMIN";
}

export function canCancel(user: AuthUser, permit: PermitLike): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "SAFETY_OFFICER") return true;
  return user.role === "REQUESTER" && user.id === permit.requesterId;
}

/**
 * Non-negotiable rule from the spec: a person can never approve their own
 * permit, even if their role would otherwise allow it (e.g. an Area Owner
 * who is also the requester on their own permit, or an Admin approving as
 * a stand-in). This check is deliberately separate from the role check
 * below and always runs first.
 */
export function isSelfApproval(user: AuthUser, permit: PermitLike): boolean {
  return user.id === permit.requesterId;
}

/**
 * Can this user approve/reject in the given approver-role slot
 * (AREA_OWNER or SAFETY_OFFICER) on this permit?
 */
export function canActOnApproval(
  user: AuthUser,
  permit: PermitLike,
  approvalRole: "AREA_OWNER" | "SAFETY_OFFICER"
): { allowed: boolean; reason?: string } {
  if (isSelfApproval(user, permit)) {
    return { allowed: false, reason: "You cannot approve your own permit." };
  }

  if (approvalRole === "SAFETY_OFFICER") {
    if (user.role === "SAFETY_OFFICER" || user.role === "ADMIN") {
      return { allowed: true };
    }
    return { allowed: false, reason: "Only a Safety Officer can act on this approval." };
  }

  // AREA_OWNER slot
  if (user.role === "ADMIN") return { allowed: true };
  if (user.role === "AREA_OWNER" && user.ownedAreaIds.includes(permit.areaId)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: "Only the owner of this permit's area can act on this approval.",
  };
}

export function canCreatePermit(user: AuthUser): boolean {
  return user.role === "REQUESTER" || user.role === "ADMIN";
}

export function canRequestExtension(user: AuthUser, permit: PermitLike): boolean {
  if (user.role === "ADMIN") return true;
  return user.role === "REQUESTER" && user.id === permit.requesterId;
}

export function canDecideExtension(user: AuthUser): boolean {
  return user.role === "SAFETY_OFFICER" || user.role === "ADMIN";
}

export function canManageAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN";
}
