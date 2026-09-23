import { formatDateTime, STATUS_LABEL } from "@/lib/permitDisplay";

interface AuditEntry {
  id: string;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  comment: string | null;
  createdAt: string;
  actor: { id: string; name: string; role: string } | null;
}

const ACTION_VERB: Record<string, string> = {
  CREATED: "created this permit",
  STATUS_CHANGE: "changed status",
  FIELD_EDIT: "edited the draft",
  APPROVAL: "approved",
  REJECTION: "rejected",
  EXTENSION_REQUESTED: "requested an extension",
  EXTENSION_APPROVED: "approved an extension",
  EXTENSION_REJECTED: "rejected an extension request",
};

function describe(entry: AuditEntry): string {
  if (entry.action === "STATUS_CHANGE" && entry.fromValue && entry.toValue) {
    const from = STATUS_LABEL[entry.fromValue] ?? entry.fromValue;
    const to = STATUS_LABEL[entry.toValue] ?? entry.toValue;
    return `${from} → ${to}`;
  }
  return ACTION_VERB[entry.action] ?? entry.action;
}

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-steel-500">No history yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {entries.map((e, i) => (
        <li key={e.id} className="relative pl-5 pb-4 last:pb-0">
          {i < entries.length - 1 && (
            <span className="absolute left-[5px] top-3 bottom-0 w-px bg-line" aria-hidden />
          )}
          <span
            className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-white"
            style={{ borderColor: "var(--steel-500)" }}
            aria-hidden
          />
          <div className="text-sm text-charcoal">
            <span className="font-medium">{e.actor?.name ?? "System"}</span> {describe(e)}
          </div>
          {e.comment && <div className="text-sm text-steel-500 mt-0.5">{e.comment}</div>}
          <div className="text-xs text-steel-500 mt-0.5">{formatDateTime(e.createdAt)}</div>
        </li>
      ))}
    </ol>
  );
}
