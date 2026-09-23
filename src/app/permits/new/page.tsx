"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TypeFieldsForm } from "@/components/TypeFieldsForm";
import { TYPE_LABEL } from "@/lib/permitDisplay";
import { getPermitTypeDef } from "@/lib/permitTypes";

const TYPES = ["HOT_WORK", "CONFINED_SPACE", "WORKING_AT_HEIGHT", "ELECTRICAL_ISOLATION"] as const;

const COMMON_HAZARDS = [
  "Open flame",
  "Flammable vapour",
  "Confined space",
  "Fall from height",
  "Electric shock",
  "Moving machinery",
  "Chemical exposure",
];
const COMMON_PPE = ["Helmet", "Gloves", "Safety boots", "Harness", "Face shield", "Gas monitor"];

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewPermitPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState<{ plants: any[]; areas: any[]; equipment: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);

  const [type, setType] = useState<(typeof TYPES)[number]>("HOT_WORK");
  const [contractorName, setContractorName] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [plantId, setPlantId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [plannedStart, setPlannedStart] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [plannedEnd, setPlannedEnd] = useState(() => toLocalInputValue(new Date(Date.now() + 4 * 60 * 60 * 1000)));
  const [hazards, setHazards] = useState<string[]>([]);
  const [ppeRequired, setPpeRequired] = useState<string[]>([]);
  const [typeFields, setTypeFields] = useState<Record<string, any>>({});
  const [precautions, setPrecautions] = useState<{ label: string; checked: boolean }[]>(
    getPermitTypeDef("HOT_WORK").defaultPrecautions.map((label) => ({ label, checked: false }))
  );

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setError("Could not load plants/areas."));
  }, []);

  useEffect(() => {
    setPrecautions(getPermitTypeDef(type).defaultPrecautions.map((label) => ({ label, checked: false })));
    setTypeFields({});
  }, [type]);

  const areasForPlant = (meta?.areas ?? []).filter((a: any) => a.plantId === plantId);
  const equipmentForArea = (meta?.equipment ?? []).filter((e: any) => e.areaId === areaId);

  function toggleFromList(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function submitPermit(action: "draft" | "submit") {
    setSaving(true);
    setError(null);

    const body = {
      type,
      contractorName,
      workDescription,
      plantId,
      areaId,
      equipmentId: equipmentId || null,
      plannedStart: new Date(plannedStart).toISOString(),
      plannedEnd: new Date(plannedEnd).toISOString(),
      hazards,
      ppeRequired,
      precautions,
      typeFields,
    };

    const res = await fetch("/api/permits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not create permit.");
      return;
    }

    setConflicts(data.conflicts ?? []);

    if (action === "draft") {
      router.push(`/permits/${data.permit.id}`);
      return;
    }

    const submitRes = await fetch(`/api/permits/${data.permit.id}/submit`, { method: "POST" });
    if (!submitRes.ok) {
      const submitData = await submitRes.json();
      setError(submitData.error ?? "Saved as draft, but could not submit.");
      router.push(`/permits/${data.permit.id}`);
      return;
    }
    router.push(`/permits/${data.permit.id}`);
  }

  const steps = ["Type & job details", "Type-specific detail", "Hazards & precautions", "Review"];

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-lg font-semibold text-charcoal mb-1">Raise a permit</h1>
        <p className="text-sm text-steel-500 mb-6">
          Authorize a job before anyone starts work. You can save this as a draft at any point.
        </p>

        <div className="flex items-center gap-2 mb-6">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={
                  step === i + 1
                    ? { background: "var(--charcoal)", color: "white" }
                    : step > i + 1
                    ? { background: "var(--green)", color: "white" }
                    : { background: "var(--steel-100)", color: "var(--steel-500)" }
                }
              >
                {i + 1}
              </div>
              <span className="text-xs text-steel-500 hidden sm:inline">{label}</span>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-line" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 text-sm px-3 py-2 rounded-sm" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
            {error}
          </div>
        )}

        <div className="bg-white border border-line rounded-sm p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-steel-700 mb-1">Permit type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className="text-left px-3 py-2 rounded-sm border text-sm"
                      style={
                        type === t
                          ? { borderColor: "var(--charcoal)", background: "var(--steel-50)" }
                          : { borderColor: "var(--line)" }
                      }
                    >
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-steel-700 mb-1">Contractor / team performing the work</label>
                <input
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm"
                  placeholder="e.g. Sundaram Fabricators"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-steel-700 mb-1">Work description</label>
                <textarea
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm"
                  placeholder="Exactly what job is being done, and why."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-steel-700 mb-1">Plant</label>
                  <select
                    value={plantId}
                    onChange={(e) => {
                      setPlantId(e.target.value);
                      setAreaId("");
                      setEquipmentId("");
                    }}
                    className="w-full border border-line rounded-sm px-2 py-2 text-sm bg-white"
                  >
                    <option value="">Select…</option>
                    {meta?.plants.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-steel-700 mb-1">Area</label>
                  <select
                    value={areaId}
                    onChange={(e) => {
                      setAreaId(e.target.value);
                      setEquipmentId("");
                    }}
                    disabled={!plantId}
                    className="w-full border border-line rounded-sm px-2 py-2 text-sm bg-white disabled:opacity-50"
                  >
                    <option value="">Select…</option>
                    {areasForPlant.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-steel-700 mb-1">Equipment</label>
                  <select
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    disabled={!areaId}
                    className="w-full border border-line rounded-sm px-2 py-2 text-sm bg-white disabled:opacity-50"
                  >
                    <option value="">None / not equipment-specific</option>
                    {equipmentForArea.map((eq: any) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.tag} — {eq.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-steel-700 mb-1">Planned start</label>
                  <input
                    type="datetime-local"
                    value={plannedStart}
                    onChange={(e) => setPlannedStart(e.target.value)}
                    className="w-full border border-line rounded-sm px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-steel-700 mb-1">Planned end</label>
                  <input
                    type="datetime-local"
                    value={plannedEnd}
                    onChange={(e) => setPlannedEnd(e.target.value)}
                    className="w-full border border-line rounded-sm px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <ChipMultiSelect label="Hazards identified" options={COMMON_HAZARDS} value={hazards} onToggle={(v) => toggleFromList(hazards, setHazards, v)} />
              <ChipMultiSelect label="PPE required" options={COMMON_PPE} value={ppeRequired} onToggle={(v) => toggleFromList(ppeRequired, setPpeRequired, v)} />
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-steel-500 mb-4">
                Fields specific to a <strong>{TYPE_LABEL[type]}</strong> permit.
              </p>
              <TypeFieldsForm type={type} values={typeFields} onChange={setTypeFields} />
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm text-steel-500 mb-4">
                Precautions the site must have in place before work starts. Pre-filled from the {TYPE_LABEL[type]} checklist — edit as needed.
              </p>
              <div className="space-y-2">
                {precautions.map((p, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={p.checked}
                      onChange={(e) => {
                        const next = [...precautions];
                        next[i] = { ...p, checked: e.target.checked };
                        setPrecautions(next);
                      }}
                    />
                    <input
                      value={p.label}
                      onChange={(e) => {
                        const next = [...precautions];
                        next[i] = { ...p, label: e.target.value };
                        setPrecautions(next);
                      }}
                      className="flex-1 border-b border-transparent hover:border-line focus:border-line text-sm bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setPrecautions(precautions.filter((_, idx) => idx !== i))}
                      className="text-xs text-steel-500"
                    >
                      Remove
                    </button>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setPrecautions([...precautions, { label: "", checked: false }])}
                  className="text-xs text-[var(--blue)] underline"
                >
                  + Add precaution
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-sm">
              <ReviewRow label="Type" value={TYPE_LABEL[type]} />
              <ReviewRow label="Contractor" value={contractorName || "—"} />
              <ReviewRow label="Work" value={workDescription || "—"} />
              <ReviewRow
                label="Location"
                value={`${meta?.areas.find((a: any) => a.id === areaId)?.name ?? "—"} / ${
                  meta?.plants.find((p: any) => p.id === plantId)?.name ?? "—"
                }`}
              />
              <ReviewRow label="Window" value={`${plannedStart.replace("T", " ")} → ${plannedEnd.replace("T", " ")}`} />
              <ReviewRow label="Hazards" value={hazards.join(", ") || "none listed"} />
              <ReviewRow label="PPE" value={ppeRequired.join(", ") || "none listed"} />
              <ReviewRow label="Precautions" value={`${precautions.length} item(s)`} />
              {conflicts.length > 0 && (
                <div className="text-xs px-3 py-2 rounded-sm" style={{ background: "var(--orange-bg)", color: "var(--orange)" }}>
                  Overlaps with {conflicts.length} other permit(s) in this area — check the permit detail page after saving.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="text-sm text-steel-500 disabled:opacity-30"
          >
            ← Back
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submitPermit("draft")}
              disabled={saving || !contractorName || !workDescription || !plantId || !areaId}
              className="text-sm px-3 py-2 rounded-sm border border-line disabled:opacity-50"
            >
              Save as draft
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="text-sm px-4 py-2 rounded-sm bg-charcoal text-white"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submitPermit("submit")}
                disabled={saving || !contractorName || !workDescription || !plantId || !areaId}
                className="text-sm px-4 py-2 rounded-sm bg-charcoal text-white disabled:opacity-50"
              >
                {saving ? "Submitting…" : "Submit for approval"}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ChipMultiSelect({
  label,
  options,
  value,
  onToggle,
}: {
  label: string;
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-steel-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className="text-xs px-2 py-1 rounded-sm border"
            style={
              value.includes(o)
                ? { background: "var(--charcoal)", color: "white", borderColor: "var(--charcoal)" }
                : { background: "white", color: "var(--steel-700)", borderColor: "var(--line)" }
            }
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-2 border-b border-line last:border-b-0">
      <div className="w-28 shrink-0 text-steel-500 text-xs pt-0.5">{label}</div>
      <div className="text-charcoal">{value}</div>
    </div>
  );
}
