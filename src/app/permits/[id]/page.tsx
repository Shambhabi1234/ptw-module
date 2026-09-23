"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { TypeTag } from "@/components/TypeTag";
import { Countdown } from "@/components/Countdown";
import { TypeFieldsView } from "@/components/TypeFieldsView";
import { AuditTimeline } from "@/components/AuditTimeline";
import { useCurrentUser } from "@/lib/client/useCurrentUser";
import { formatDateTime } from "@/lib/permitDisplay";
import { availableActions, type Action } from "@/lib/stateMachine";

export default function PermitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();

  const [permit, setPermit] = useState<any>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [openForm, setOpenForm] = useState<
    null | "reject_area" | "reject_safety" | "suspend" | "close" | "cancel" | "extension"
  >(null);
  const [formText, setFormText] = useState("");
  const [extHours, setExtHours] = useState(2);

  const load = useCallback(async () => {
    const res = await fetch(`/api/permits/${id}`);
    const data = await res.json();
    if (res.ok) {
      setPermit(data.permit);
      setConflicts(data.conflicts ?? []);
    } else {
      setError(data.error ?? "Could not load permit.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(path: string, body?: Record<string, unknown>, method: "POST" | "PATCH" = "POST") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/permits/${id}/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Action failed.");
      return false;
    }
    setPermit(data.permit);
    setOpenForm(null);
    setFormText("");
    return true;
  }

  if (loading) {
    return (
      <AppShell>
        <div className="text-sm text-steel-500">Loading…</div>
      </AppShell>
    );
  }

  if (!permit) {
    return (
      <AppShell>
        <div className="text-sm" style={{ color: "var(--red)" }}>
          {error ?? "Permit not found."}
        </div>
      </AppShell>
    );
  }

  const allApproved = permit.approvals.length > 0 && permit.approvals.every((a: any) => a.status === "APPROVED");
  const actions: Action[] = user ? availableActions(permit.status, allApproved) : [];

  const isRequester = user?.id === permit.requesterId;
  const isSelfApproval = user?.id === permit.requesterId;
  const isAreaOwnerHere = user?.role === "AREA_OWNER" && permit.area.ownerId === user.id;
  const isSafetyOfficer = user?.role === "SAFETY_OFFICER";
  const isAdmin = user?.role === "ADMIN";

  const areaApproval = permit.approvals.find((a: any) => a.approverRole === "AREA_OWNER");
  const safetyApproval = permit.approvals.find((a: any) => a.approverRole === "SAFETY_OFFICER");

  const canActOnAreaApproval =
    !isSelfApproval && areaApproval?.status === "PENDING" && (isAreaOwnerHere || isAdmin);
  const canActOnSafetyApproval =
    !isSelfApproval && safetyApproval?.status === "PENDING" && (isSafetyOfficer || isAdmin);

  const canSubmit = actions.includes("SUBMIT") && (isRequester || isAdmin);
  const canActivate = actions.includes("ACTIVATE") && (isRequester || isAdmin);
  const canSuspend = actions.includes("SUSPEND") && (isSafetyOfficer || isAdmin);
  const canResume = actions.includes("RESUME") && (isSafetyOfficer || isAdmin);
  const canClose = actions.includes("CLOSE") && (isRequester || isAdmin);
  const canVerify = actions.includes("VERIFY") && (isSafetyOfficer || isAdmin);
  const canCancel = actions.includes("CANCEL") && (isRequester || isSafetyOfficer || isAdmin);
  const canRequestExtension = permit.status === "ACTIVE" && (isRequester || isAdmin);

  const pendingExtension = permit.extensionRequests?.find((e: any) => e.status === "PENDING");
  const canDecideExtension = !!pendingExtension && (isSafetyOfficer || isAdmin);

  return (
    <AppShell>
      <button onClick={() => router.push("/")} className="text-xs text-steel-500 mb-4">
        ← Back to dashboard
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="permit-code text-sm text-steel-500">{permit.code}</div>
          <h1 className="text-xl font-semibold text-charcoal mt-1">{permit.workDescription}</h1>
          <div className="flex items-center gap-3 mt-2">
            <TypeTag type={permit.type} />
            <StatusBadge status={permit.status} />
            {permit.status === "ACTIVE" && <Countdown to={permit.plannedEnd} />}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm px-3 py-2 rounded-sm" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
          {error}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mb-4 text-sm px-3 py-2 rounded-sm" style={{ background: "var(--orange-bg)", color: "var(--orange)" }}>
          <strong>Scheduling conflict:</strong> this overlaps in time and area with{" "}
          {conflicts.map((c: any, i: number) => (
            <span key={c.permitId}>
              {i > 0 && ", "}
              <a href={`/permits/${c.permitId}`} className="underline">
                {c.code}
              </a>
            </span>
          ))}
          . Hot work and confined space entry in the same area at the same time is a known accident cause — confirm compensating controls before activating.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Section title="1. Job details">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Requester" value={permit.requester.name} />
              <Field label="Contractor / team" value={permit.contractorName} />
              <Field label="Plant" value={permit.plant.name} />
              <Field
                label="Area"
                value={`${permit.area.name}${permit.area.owner ? ` (owner: ${permit.area.owner.name})` : " (no owner assigned)"}`}
              />
              <Field label="Equipment" value={permit.equipment ? `${permit.equipment.tag} — ${permit.equipment.name}` : "Not equipment-specific"} />
              <Field label="Planned window" value={`${formatDateTime(permit.plannedStart)} → ${formatDateTime(permit.plannedEnd)}`} />
              <Field label="Hazards identified" value={permit.hazards.length ? permit.hazards.join(", ") : "None listed"} />
              <Field label="PPE required" value={permit.ppeRequired.length ? permit.ppeRequired.join(", ") : "None listed"} />
            </dl>
          </Section>

          <Section title={`2. ${permit.type.replace(/_/g, " ")} details`}>
            <TypeFieldsView type={permit.type} values={permit.typeFields} />
          </Section>

          <Section title="3. Precautions">
            <ul className="space-y-1.5">
              {(permit.precautions as any[]).map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-4 h-4 rounded-sm border flex items-center justify-center text-[10px]"
                    style={
                      p.checked
                        ? { background: "var(--green)", borderColor: "var(--green)", color: "white" }
                        : { borderColor: "var(--line)" }
                    }
                  >
                    {p.checked ? "✓" : ""}
                  </span>
                  <span className={p.checked ? "text-charcoal" : "text-steel-500"}>{p.label}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="4. Approvals">
            <div className="space-y-3">
              <ApprovalRow
                title="Area Owner"
                approval={areaApproval}
                canAct={canActOnAreaApproval}
                busy={busy}
                onApprove={() => act("approve", { approvalRole: "AREA_OWNER", decision: "APPROVE" })}
                onReject={() => setOpenForm("reject_area")}
              />
              <ApprovalRow
                title="Safety Officer"
                approval={safetyApproval}
                canAct={canActOnSafetyApproval}
                busy={busy}
                onApprove={() => act("approve", { approvalRole: "SAFETY_OFFICER", decision: "APPROVE" })}
                onReject={() => setOpenForm("reject_safety")}
              />
              {isSelfApproval && permit.status === "PENDING_APPROVAL" && (
                <p className="text-xs text-steel-500">
                  You raised this permit, so you cannot approve it yourself — even if your role normally could.
                </p>
              )}
            </div>

            {openForm === "reject_area" || openForm === "reject_safety" ? (
              <ReasonForm
                label="Reason for rejection (required)"
                value={formText}
                onChange={setFormText}
                busy={busy}
                onCancel={() => setOpenForm(null)}
                onSubmit={() =>
                  act("approve", {
                    approvalRole: openForm === "reject_area" ? "AREA_OWNER" : "SAFETY_OFFICER",
                    decision: "REJECT",
                    comment: formText,
                  })
                }
                submitLabel="Reject permit"
              />
            ) : null}
          </Section>

          {permit.status === "CLOSED" && (
            <Section title="5. Closure">
              <Field label="Completion notes" value={permit.closeNotes ?? "—"} />
            </Section>
          )}

          <Section title="Audit trail">
            <AuditTimeline entries={permit.auditLog} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Actions">
            <div className="flex flex-col gap-2">
              {canSubmit && <ActionButton label="Submit for approval" onClick={() => act("submit")} busy={busy} />}
              {canActivate && <ActionButton label="Activate" onClick={() => act("activate")} busy={busy} primary />}
              {canSuspend && <ActionButton label="Suspend" onClick={() => setOpenForm("suspend")} busy={busy} danger />}
              {canResume && <ActionButton label="Resume" onClick={() => act("resume")} busy={busy} primary />}
              {canClose && <ActionButton label="Mark work complete" onClick={() => setOpenForm("close")} busy={busy} />}
              {canVerify && <ActionButton label="Verify & close out" onClick={() => act("verify")} busy={busy} primary />}
              {canRequestExtension && (
                <ActionButton label="Request extension" onClick={() => setOpenForm("extension")} busy={busy} />
              )}
              {canCancel && <ActionButton label="Cancel permit" onClick={() => setOpenForm("cancel")} busy={busy} danger />}
              {!canSubmit &&
                !canActivate &&
                !canSuspend &&
                !canResume &&
                !canClose &&
                !canVerify &&
                !canCancel &&
                !canRequestExtension && (
                  <p className="text-xs text-steel-500">No actions available to you on this permit right now.</p>
                )}
            </div>

            {openForm === "suspend" && (
              <ReasonForm
                label="Reason for suspension (required)"
                value={formText}
                onChange={setFormText}
                busy={busy}
                onCancel={() => setOpenForm(null)}
                onSubmit={() => act("suspend", { reason: formText })}
                submitLabel="Suspend"
              />
            )}
            {openForm === "close" && (
              <ReasonForm
                label="Completion notes (required)"
                value={formText}
                onChange={setFormText}
                busy={busy}
                onCancel={() => setOpenForm(null)}
                onSubmit={() => act("close", { notes: formText })}
                submitLabel="Mark complete"
              />
            )}
            {openForm === "cancel" && (
              <ReasonForm
                label="Reason for cancellation (required)"
                value={formText}
                onChange={setFormText}
                busy={busy}
                onCancel={() => setOpenForm(null)}
                onSubmit={() => act("cancel", { reason: formText })}
                submitLabel="Cancel permit"
              />
            )}
            {openForm === "extension" && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-medium text-steel-700">Extra hours (max 8)</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={extHours}
                  onChange={(e) => setExtHours(Number(e.target.value))}
                  className="w-full border border-line rounded-sm px-2 py-1.5 text-sm"
                />
                <ReasonForm
                  label="Reason (required)"
                  value={formText}
                  onChange={setFormText}
                  busy={busy}
                  onCancel={() => setOpenForm(null)}
                  onSubmit={() => act("extension", { hours: extHours, reason: formText })}
                  submitLabel="Request extension"
                />
              </div>
            )}
          </Section>

          {pendingExtension && (
            <Section title="Extension request">
              <p className="text-sm text-charcoal">
                +{pendingExtension.hours}h — {pendingExtension.reason}
              </p>
              {canDecideExtension && (
                <div className="flex gap-2 mt-3">
                  <ActionButton
                    label="Approve"
                    primary
                    busy={busy}
                    onClick={() =>
                      act("extension", { extensionRequestId: pendingExtension.id, decision: "APPROVE" }, "PATCH")
                    }
                  />
                  <ActionButton
                    label="Reject"
                    danger
                    busy={busy}
                    onClick={() =>
                      act("extension", { extensionRequestId: pendingExtension.id, decision: "REJECT" }, "PATCH")
                    }
                  />
                </div>
              )}
            </Section>
          )}

          <Section title="Who's involved">
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-charcoal">{permit.requester.name}</div>
                <div className="text-xs text-steel-500">Requester</div>
              </div>
              {permit.area.owner && (
                <div>
                  <div className="text-charcoal">{permit.area.owner.name}</div>
                  <div className="text-xs text-steel-500">Area Owner</div>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-line rounded-sm p-5">
      <h2 className="text-sm font-semibold text-charcoal mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-steel-500">{label}</dt>
      <dd className="text-charcoal mt-0.5">{value}</dd>
    </div>
  );
}

function ApprovalRow({
  title,
  approval,
  canAct,
  busy,
  onApprove,
  onReject,
}: {
  title: string;
  approval: any;
  canAct: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const status = approval?.status ?? "PENDING";
  const color = status === "APPROVED" ? "var(--green)" : status === "REJECTED" ? "var(--red)" : "var(--amber)";
  return (
    <div className="flex items-center justify-between border border-line rounded-sm px-3 py-2">
      <div>
        <div className="text-sm text-charcoal">{title}</div>
        <div className="text-xs" style={{ color }}>
          {status === "PENDING"
            ? "Awaiting decision"
            : `${status === "APPROVED" ? "Approved" : "Rejected"}${approval?.approver ? ` by ${approval.approver.name}` : ""}`}
        </div>
        {approval?.comment && <div className="text-xs text-steel-500 mt-0.5">"{approval.comment}"</div>}
      </div>
      {canAct && (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={busy}
            className="text-xs px-2 py-1 rounded-sm text-white"
            style={{ background: "var(--green)" }}
          >
            Approve
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="text-xs px-2 py-1 rounded-sm text-white"
            style={{ background: "var(--red)" }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function ReasonForm({
  label,
  value,
  onChange,
  onCancel,
  onSubmit,
  busy,
  submitLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  return (
    <div className="mt-3 space-y-2">
      <label className="block text-xs font-medium text-steel-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full border border-line rounded-sm px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={busy || !value.trim()}
          className="text-xs px-3 py-1.5 rounded-sm bg-charcoal text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-sm border border-line">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  primary,
  danger,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const style = primary
    ? { background: "var(--green)", color: "white" }
    : danger
    ? { background: "white", color: "var(--red)", borderColor: "var(--red)" }
    : { background: "white", color: "var(--charcoal)", borderColor: "var(--line)" };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-sm px-3 py-2 rounded-sm border disabled:opacity-50 text-left"
      style={style}
    >
      {label}
    </button>
  );
}
