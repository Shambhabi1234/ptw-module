export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
  REJECTED: "Rejected",
  CLOSED: "Closed",
  CLOSED_VERIFIED: "Closed & verified",
  CANCELLED: "Cancelled",
};

export const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  DRAFT: { fg: "var(--grey)", bg: "var(--grey-bg)" },
  PENDING_APPROVAL: { fg: "var(--amber)", bg: "var(--amber-bg)" },
  APPROVED: { fg: "var(--green)", bg: "var(--green-bg)" },
  ACTIVE: { fg: "var(--green)", bg: "var(--green-bg)" },
  SUSPENDED: { fg: "var(--orange)", bg: "var(--orange-bg)" },
  EXPIRED: { fg: "var(--red)", bg: "var(--red-bg)" },
  REJECTED: { fg: "var(--red)", bg: "var(--red-bg)" },
  CLOSED: { fg: "var(--blue)", bg: "var(--blue-bg)" },
  CLOSED_VERIFIED: { fg: "var(--blue)", bg: "var(--blue-bg)" },
  CANCELLED: { fg: "var(--grey)", bg: "var(--grey-bg)" },
};

export const TYPE_LABEL: Record<string, string> = {
  HOT_WORK: "Hot Work",
  CONFINED_SPACE: "Confined Space Entry",
  WORKING_AT_HEIGHT: "Working at Height",
  ELECTRICAL_ISOLATION: "Electrical / Isolation",
};

export const TYPE_COLOR: Record<string, string> = {
  HOT_WORK: "var(--type-hot-work)",
  CONFINED_SPACE: "var(--type-confined-space)",
  WORKING_AT_HEIGHT: "var(--type-working-at-height)",
  ELECTRICAL_ISOLATION: "var(--type-electrical)",
};

export const ACTION_LABEL: Record<string, string> = {
  SUBMIT: "Submit for approval",
  APPROVE: "Approve",
  REJECT: "Reject",
  ACTIVATE: "Activate",
  SUSPEND: "Suspend",
  RESUME: "Resume",
  EXPIRE: "Expire",
  CLOSE: "Mark work complete",
  VERIFY: "Verify & close out",
  CANCEL: "Cancel permit",
};

export const ROLE_LABEL: Record<string, string> = {
  REQUESTER: "Requester",
  AREA_OWNER: "Area Owner",
  SAFETY_OFFICER: "Safety Officer",
  ADMIN: "Admin",
};

export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
