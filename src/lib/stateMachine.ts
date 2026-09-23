import type { PermitStatus } from "@prisma/client";

export type Action =
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "ACTIVATE"
  | "SUSPEND"
  | "RESUME"
  | "EXPIRE"
  | "CLOSE"
  | "VERIFY"
  | "CANCEL";

export interface TransitionContext {
  status: PermitStatus;
  action: Action;
  now: Date;
  plannedStart: Date;
  plannedEnd: Date;
  /** true once every required PermitApproval row is APPROVED */
  allApproversApproved: boolean;
}

export interface TransitionResult {
  ok: boolean;
  nextStatus?: PermitStatus;
  error?: string;
}

// Every state's allowed outgoing actions, and what state each leads to.
// CANCEL is handled separately below because it's valid from every
// non-terminal state, which would otherwise duplicate 6 lines.
const TRANSITIONS: Partial<Record<PermitStatus, Partial<Record<Action, PermitStatus>>>> = {
  DRAFT: {
    SUBMIT: "PENDING_APPROVAL",
  },
  PENDING_APPROVAL: {
    APPROVE: "APPROVED", // only actually moves once allApproversApproved — checked below
    REJECT: "REJECTED",
  },
  APPROVED: {
    ACTIVATE: "ACTIVE",
    EXPIRE: "EXPIRED",
  },
  ACTIVE: {
    SUSPEND: "SUSPENDED",
    EXPIRE: "EXPIRED",
    CLOSE: "CLOSED",
  },
  SUSPENDED: {
    RESUME: "ACTIVE",
    EXPIRE: "EXPIRED",
  },
  CLOSED: {
    VERIFY: "CLOSED_VERIFIED",
  },
};

const TERMINAL_STATES: PermitStatus[] = [
  "REJECTED",
  "EXPIRED",
  "CLOSED_VERIFIED",
  "CANCELLED",
];

const CANCELLABLE_FROM: PermitStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
];

export function isTerminal(status: PermitStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Pure function: given the current status + an action + the context needed
 * to evaluate the guard conditions, returns whether the transition is legal
 * and what the resulting status is. No I/O, no Prisma — that's what makes
 * it cheap to unit test exhaustively and impossible to bypass, since every
 * API route MUST call this before writing a new status.
 */
export function transition(ctx: TransitionContext): TransitionResult {
  const { status, action, now, plannedStart, plannedEnd, allApproversApproved } = ctx;

  if (action === "CANCEL") {
    if (!CANCELLABLE_FROM.includes(status)) {
      return { ok: false, error: `Cannot cancel a permit in status ${status}.` };
    }
    return { ok: true, nextStatus: "CANCELLED" };
  }

  const table = TRANSITIONS[status];
  const nextStatus = table?.[action];

  if (!nextStatus) {
    return {
      ok: false,
      error: `Action ${action} is not valid from status ${status}.`,
    };
  }

  // Guard: APPROVE only actually promotes to APPROVED once every required
  // approver has signed off. Individual approvals are recorded on the
  // PermitApproval rows regardless (handled by the caller); this guard is
  // specifically about the permit-level status transition.
  if (action === "APPROVE" && !allApproversApproved) {
    return { ok: false, error: "Not all required approvers have approved yet." };
  }

  // Guard: cannot activate before the planned start time.
  if (action === "ACTIVATE" && now < plannedStart) {
    return {
      ok: false,
      error: `Cannot activate before the planned start time (${plannedStart.toISOString()}).`,
    };
  }

  // Guard: an APPROVED permit whose window has already fully passed should
  // expire, not activate. (In practice EXPIRE would have already fired via
  // the lazy-expiry check, but we don't trust that ran.)
  if (action === "ACTIVATE" && now > plannedEnd) {
    return {
      ok: false,
      error: "The planned window for this permit has already passed. Raise a new permit.",
    };
  }

  // Guard: EXPIRE is only a legal, meaningful transition once the window
  // has actually passed. (Prevents someone POSTing action=EXPIRE early.)
  if (action === "EXPIRE" && now < plannedEnd) {
    return { ok: false, error: "Permit has not passed its planned end time yet." };
  }

  return { ok: true, nextStatus };
}

/** Convenience used by the UI to decide which action buttons to even render. */
export function availableActions(
  status: PermitStatus,
  allApproversApproved: boolean
): Action[] {
  const actions: Action[] = [];
  const table = TRANSITIONS[status];
  if (table) {
    for (const action of Object.keys(table) as Action[]) {
      if (action === "APPROVE" && !allApproversApproved) continue;
      actions.push(action);
    }
  }
  if (CANCELLABLE_FROM.includes(status)) actions.push("CANCEL");
  return actions;
}
