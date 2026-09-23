"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { TypeTag } from "@/components/TypeTag";
import { Countdown } from "@/components/Countdown";
import { useCurrentUser } from "@/lib/client/useCurrentUser";
import { formatDateTime, STATUS_LABEL, TYPE_LABEL, TYPE_COLOR } from "@/lib/permitDisplay";

interface Permit {
  id: string;
  code: string;
  type: string;
  status: string;
  contractorName: string;
  workDescription: string;
  plannedStart: string;
  plannedEnd: string;
  requester: { id: string; name: string };
  area: { id: string; name: string };
  plant: { id: string; name: string };
  equipment: { id: string; tag: string; name: string } | null;
}

interface Area {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "REJECTED",
  "CLOSED",
  "CLOSED_VERIFIED",
  "CANCELLED",
];
const TYPE_OPTIONS = ["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL_ISOLATION"];

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const [permits, setPermits] = useState<Permit[] | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [areaId, setAreaId] = useState("");
  const [myApprovals, setMyApprovals] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => setAreas(d.areas ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (areaId) params.set("areaId", areaId);
    if (myApprovals) params.set("myApprovals", "true");
    if (expiringSoon) params.set("expiringSoon", "true");
    fetch(`/api/permits?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setPermits(d.permits ?? []))
      .catch(() => setPermits([]));
  }, [user, status, type, areaId, myApprovals, expiringSoon]);

  const summary = useMemo(() => {
    if (!permits) return null;
    const active = permits.filter((p) => p.status === "ACTIVE").length;
    const now = Date.now();
    const soon = permits.filter(
      (p) => p.status === "ACTIVE" && new Date(p.plannedEnd).getTime() - now < 2 * 60 * 60 * 1000
    ).length;
    const pending = permits.filter((p) => p.status === "PENDING_APPROVAL").length;
    return { active, soon, pending };
  }, [permits]);

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-charcoal">Permits</h1>
          <p className="text-sm text-steel-500 mt-0.5">
            What's live right now, and what needs your attention.
          </p>
        </div>
        {(user?.role === "REQUESTER" || user?.role === "ADMIN") && (
          <Link
            href="/permits/new"
            className="bg-charcoal text-white text-sm font-medium px-3 py-2 rounded-sm"
          >
            + New permit
          </Link>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryCard label="Active right now" value={summary.active} color="var(--green)" />
          <SummaryCard label="Expiring within 2 hours" value={summary.soon} color="var(--orange)" />
          <SummaryCard label="Awaiting approval" value={summary.pending} color="var(--amber)" />
        </div>
      )}

      <div className="bg-white border border-line rounded-sm p-3 mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="All statuses"
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        <FilterSelect
          value={type}
          onChange={setType}
          placeholder="All types"
          options={TYPE_OPTIONS.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        />
        <FilterSelect
          value={areaId}
          onChange={setAreaId}
          placeholder="All areas"
          options={areas.map((a) => ({ value: a.id, label: a.name }))}
        />
        {(user?.role === "AREA_OWNER" || user?.role === "SAFETY_OFFICER" || user?.role === "ADMIN") && (
          <ToggleChip label="My approvals pending" active={myApprovals} onClick={() => setMyApprovals((v) => !v)} />
        )}
        <ToggleChip label="Expiring soon" active={expiringSoon} onClick={() => setExpiringSoon((v) => !v)} />
        {(status || type || areaId || myApprovals || expiringSoon) && (
          <button
            className="text-xs text-steel-500 underline ml-auto"
            onClick={() => {
              setStatus("");
              setType("");
              setAreaId("");
              setMyApprovals(false);
              setExpiringSoon(false);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white border border-line rounded-sm overflow-hidden">
        {permits === null && <div className="p-6 text-sm text-steel-500">Loading…</div>}
        {permits?.length === 0 && (
          <div className="p-10 text-center text-sm text-steel-500">
            No permits match these filters.
          </div>
        )}
        {permits?.map((p) => (
          <Link
            key={p.id}
            href={`/permits/${p.id}`}
            className="flex items-stretch border-b border-line last:border-b-0 hover:bg-steel-50 transition-colors"
          >
            <div className="w-1" style={{ background: TYPE_COLOR[p.type] }} />
            <div className="flex-1 px-4 py-3 flex items-center gap-4 min-w-0">
              <div className="w-40 shrink-0">
                <div className="permit-code text-xs text-steel-500">{p.code}</div>
                <TypeTag type={p.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-charcoal truncate">{p.workDescription}</div>
                <div className="text-xs text-steel-500 mt-0.5">
                  {p.area.name} · {p.plant.name}
                  {p.equipment ? ` · ${p.equipment.tag}` : ""} · requested by {p.requester.name}
                </div>
              </div>
              <div className="hidden md:block text-xs text-steel-500 w-44 shrink-0">
                {formatDateTime(p.plannedStart)} →<br />
                {formatDateTime(p.plannedEnd)}
              </div>
              <div className="w-32 shrink-0 text-right">
                {p.status === "ACTIVE" && <Countdown to={p.plannedEnd} />}
              </div>
              <div className="w-36 shrink-0 flex justify-end">
                <StatusBadge status={p.status} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-line rounded-sm p-4">
      <div className="text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-steel-500 mt-1">{label}</div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-line rounded-sm px-2 py-1.5 bg-white text-charcoal"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1.5 rounded-sm border"
      style={
        active
          ? { background: "var(--charcoal)", color: "white", borderColor: "var(--charcoal)" }
          : { background: "white", color: "var(--steel-700)", borderColor: "var(--line)" }
      }
    >
      {label}
    </button>
  );
}
