import { describe, it, expect } from "vitest";
import { transition, availableActions, isTerminal } from "../stateMachine";

const HOUR = 60 * 60 * 1000;

function ctx(overrides: Partial<Parameters<typeof transition>[0]> = {}) {
  const now = new Date("2026-06-01T10:00:00Z");
  return {
    status: "DRAFT" as const,
    action: "SUBMIT" as const,
    now,
    plannedStart: new Date(now.getTime() - HOUR),
    plannedEnd: new Date(now.getTime() + HOUR),
    allApproversApproved: false,
    ...overrides,
  };
}

describe("state machine — happy path", () => {
  it("DRAFT --submit--> PENDING_APPROVAL", () => {
    const r = transition(ctx({ status: "DRAFT", action: "SUBMIT" }));
    expect(r.ok).toBe(true);
    expect(r.nextStatus).toBe("PENDING_APPROVAL");
  });

  it("PENDING_APPROVAL --approve (all approved)--> APPROVED", () => {
    const r = transition(
      ctx({ status: "PENDING_APPROVAL", action: "APPROVE", allApproversApproved: true })
    );
    expect(r.ok).toBe(true);
    expect(r.nextStatus).toBe("APPROVED");
  });

  it("PENDING_APPROVAL --approve (not all approved)--> rejected transition", () => {
    const r = transition(
      ctx({ status: "PENDING_APPROVAL", action: "APPROVE", allApproversApproved: false })
    );
    expect(r.ok).toBe(false);
  });

  it("PENDING_APPROVAL --reject--> REJECTED", () => {
    const r = transition(ctx({ status: "PENDING_APPROVAL", action: "REJECT" }));
    expect(r.ok).toBe(true);
    expect(r.nextStatus).toBe("REJECTED");
  });

  it("APPROVED --activate--> ACTIVE, only after planned start", () => {
    const now = new Date("2026-06-01T10:00:00Z");
    const ok = transition(
      ctx({
        status: "APPROVED",
        action: "ACTIVATE",
        now,
        plannedStart: new Date(now.getTime() - HOUR),
        plannedEnd: new Date(now.getTime() + HOUR),
      })
    );
    expect(ok.ok).toBe(true);
    expect(ok.nextStatus).toBe("ACTIVE");

    const tooEarly = transition(
      ctx({
        status: "APPROVED",
        action: "ACTIVATE",
        now,
        plannedStart: new Date(now.getTime() + HOUR), // starts in the future
        plannedEnd: new Date(now.getTime() + 2 * HOUR),
      })
    );
    expect(tooEarly.ok).toBe(false);
  });

  it("ACTIVE --suspend--> SUSPENDED --resume--> ACTIVE", () => {
    const s = transition(ctx({ status: "ACTIVE", action: "SUSPEND" }));
    expect(s.nextStatus).toBe("SUSPENDED");
    const r = transition(ctx({ status: "SUSPENDED", action: "RESUME" }));
    expect(r.nextStatus).toBe("ACTIVE");
  });

  it("ACTIVE --close--> CLOSED --verify--> CLOSED_VERIFIED", () => {
    const c = transition(ctx({ status: "ACTIVE", action: "CLOSE" }));
    expect(c.nextStatus).toBe("CLOSED");
    const v = transition(ctx({ status: "CLOSED", action: "VERIFY" }));
    expect(v.nextStatus).toBe("CLOSED_VERIFIED");
  });
});

describe("state machine — expiry", () => {
  it("ACTIVE expires once past plannedEnd, not before", () => {
    const now = new Date("2026-06-01T10:00:00Z");
    const tooEarly = transition(
      ctx({ status: "ACTIVE", action: "EXPIRE", now, plannedEnd: new Date(now.getTime() + HOUR) })
    );
    expect(tooEarly.ok).toBe(false);

    const late = transition(
      ctx({ status: "ACTIVE", action: "EXPIRE", now, plannedEnd: new Date(now.getTime() - HOUR) })
    );
    expect(late.ok).toBe(true);
    expect(late.nextStatus).toBe("EXPIRED");
  });

  it("EXPIRED can never be reactivated — no transitions defined out of it", () => {
    for (const action of [
      "SUBMIT",
      "APPROVE",
      "REJECT",
      "ACTIVATE",
      "SUSPEND",
      "RESUME",
      "EXPIRE",
      "CLOSE",
      "VERIFY",
    ] as const) {
      const r = transition(ctx({ status: "EXPIRED", action }));
      expect(r.ok).toBe(false);
    }
    // CANCEL is also blocked because EXPIRED is a terminal state.
    const cancel = transition(ctx({ status: "EXPIRED", action: "CANCEL" }));
    expect(cancel.ok).toBe(false);
  });
});

describe("state machine — illegal transitions rejected", () => {
  const illegalPairs: Array<[string, string]> = [
    ["DRAFT", "APPROVE"],
    ["DRAFT", "ACTIVATE"],
    ["DRAFT", "CLOSE"],
    ["PENDING_APPROVAL", "ACTIVATE"],
    ["PENDING_APPROVAL", "CLOSE"],
    ["APPROVED", "SUBMIT"],
    ["APPROVED", "SUSPEND"],
    ["ACTIVE", "SUBMIT"],
    ["ACTIVE", "APPROVE"],
    ["REJECTED", "SUBMIT"],
    ["CLOSED_VERIFIED", "CANCEL"],
    ["CANCELLED", "SUBMIT"],
  ];

  it.each(illegalPairs)("%s --%s--> is rejected", (status, action) => {
    const r = transition(ctx({ status: status as any, action: action as any }));
    expect(r.ok).toBe(false);
  });
});

describe("state machine — cancellation", () => {
  it("is allowed from every non-terminal state", () => {
    for (const status of [
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "ACTIVE",
      "SUSPENDED",
    ] as const) {
      const r = transition(ctx({ status, action: "CANCEL" }));
      expect(r.ok).toBe(true);
      expect(r.nextStatus).toBe("CANCELLED");
    }
  });

  it("is rejected from every terminal state, and from CLOSED", () => {
    for (const status of ["REJECTED", "EXPIRED", "CLOSED_VERIFIED", "CANCELLED", "CLOSED"] as const) {
      const r = transition(ctx({ status, action: "CANCEL" }));
      expect(r.ok).toBe(false);
    }
  });
});

describe("availableActions / isTerminal", () => {
  it("hides APPROVE until all approvers have approved", () => {
    expect(availableActions("PENDING_APPROVAL", false)).not.toContain("APPROVE");
    expect(availableActions("PENDING_APPROVAL", true)).toContain("APPROVE");
  });

  it("flags terminal states correctly", () => {
    expect(isTerminal("EXPIRED")).toBe(true);
    expect(isTerminal("REJECTED")).toBe(true);
    expect(isTerminal("CLOSED_VERIFIED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("ACTIVE")).toBe(false);
    expect(isTerminal("CLOSED")).toBe(false);
  });
});
