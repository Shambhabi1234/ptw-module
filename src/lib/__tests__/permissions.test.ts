import { describe, it, expect } from "vitest";
import {
  canActOnApproval,
  canSuspend,
  canCreatePermit,
  isSelfApproval,
  type AuthUser,
  type PermitLike,
} from "../permissions";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: "u1", role: "AREA_OWNER", ownedAreaIds: ["area-1"], ...overrides };
}

function permit(overrides: Partial<PermitLike> = {}): PermitLike {
  return { requesterId: "requester-1", areaId: "area-1", status: "PENDING_APPROVAL", ...overrides };
}

describe("self-approval is always blocked", () => {
  it("blocks an area owner approving their own permit even though they own the area", () => {
    const u = user({ id: "requester-1", role: "AREA_OWNER", ownedAreaIds: ["area-1"] });
    const p = permit({ requesterId: "requester-1", areaId: "area-1" });
    expect(isSelfApproval(u, p)).toBe(true);
    const result = canActOnApproval(u, p, "AREA_OWNER");
    expect(result.allowed).toBe(false);
  });

  it("blocks a safety officer approving their own permit", () => {
    const u = user({ id: "so-1", role: "SAFETY_OFFICER", ownedAreaIds: [] });
    const p = permit({ requesterId: "so-1" });
    const result = canActOnApproval(u, p, "SAFETY_OFFICER");
    expect(result.allowed).toBe(false);
  });

  it("blocks an admin approving their own permit", () => {
    const u = user({ id: "admin-1", role: "ADMIN", ownedAreaIds: [] });
    const p = permit({ requesterId: "admin-1" });
    expect(canActOnApproval(u, p, "AREA_OWNER").allowed).toBe(false);
    expect(canActOnApproval(u, p, "SAFETY_OFFICER").allowed).toBe(false);
  });
});

describe("area owner scoping", () => {
  it("allows an area owner to approve permits in their own area", () => {
    const u = user({ id: "owner-1", role: "AREA_OWNER", ownedAreaIds: ["area-1"] });
    const p = permit({ requesterId: "someone-else", areaId: "area-1" });
    expect(canActOnApproval(u, p, "AREA_OWNER").allowed).toBe(true);
  });

  it("blocks an area owner from approving permits in a DIFFERENT area", () => {
    const u = user({ id: "owner-1", role: "AREA_OWNER", ownedAreaIds: ["area-1"] });
    const p = permit({ requesterId: "someone-else", areaId: "area-2" });
    const result = canActOnApproval(u, p, "AREA_OWNER");
    expect(result.allowed).toBe(false);
  });

  it("blocks an area owner from acting on the safety officer slot", () => {
    const u = user({ id: "owner-1", role: "AREA_OWNER", ownedAreaIds: ["area-1"] });
    const p = permit({ requesterId: "someone-else", areaId: "area-1" });
    expect(canActOnApproval(u, p, "SAFETY_OFFICER").allowed).toBe(false);
  });
});

describe("safety officer can approve any area", () => {
  it("allows a safety officer to approve in the AREA_OWNER slot's sibling safety slot regardless of area", () => {
    const u = user({ id: "so-1", role: "SAFETY_OFFICER", ownedAreaIds: [] });
    const p = permit({ requesterId: "someone-else", areaId: "any-area" });
    expect(canActOnApproval(u, p, "SAFETY_OFFICER").allowed).toBe(true);
  });
});

describe("role gates", () => {
  it("only safety officer / admin can suspend", () => {
    expect(canSuspend(user({ role: "SAFETY_OFFICER" }))).toBe(true);
    expect(canSuspend(user({ role: "ADMIN" }))).toBe(true);
    expect(canSuspend(user({ role: "AREA_OWNER" }))).toBe(false);
    expect(canSuspend(user({ role: "REQUESTER" }))).toBe(false);
  });

  it("only requester / admin can create permits", () => {
    expect(canCreatePermit(user({ role: "REQUESTER" }))).toBe(true);
    expect(canCreatePermit(user({ role: "ADMIN" }))).toBe(true);
    expect(canCreatePermit(user({ role: "AREA_OWNER" }))).toBe(false);
    expect(canCreatePermit(user({ role: "SAFETY_OFFICER" }))).toBe(false);
  });
});
