"use client";

import { getPermitTypeDef } from "@/lib/permitTypes";
import type { PermitType } from "@prisma/client";

export function TypeFieldsForm({
  type,
  values,
  onChange,
}: {
  type: PermitType;
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const def = getPermitTypeDef(type);

  function set(key: string, value: any) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-4">
      {def.fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-steel-700 mb-1">{f.label}</label>

          {f.kind === "text" && (
            <input
              type="text"
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm"
            />
          )}

          {f.kind === "number" && (
            <input
              type="number"
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value === "" ? undefined : Number(e.target.value))}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm"
            />
          )}

          {f.kind === "textarea" && (
            <textarea
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              rows={3}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm"
            />
          )}

          {f.kind === "boolean" && (
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={!!values[f.key]}
                onChange={(e) => set(f.key, e.target.checked)}
              />
              Confirmed
            </label>
          )}

          {f.kind === "select" && (
            <select
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white"
            >
              <option value="">Select…</option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}

          {f.kind === "stringArray" && (
            <StringArrayInput
              value={values[f.key] ?? []}
              onChange={(v) => set(f.key, v)}
            />
          )}

          {f.kind === "gasTest" && (
            <GasTestInput value={values[f.key] ?? {}} onChange={(v) => set(f.key, v)} />
          )}
        </div>
      ))}
    </div>
  );
}

function StringArrayInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1">
      {value.map((v, i) => (
        <div key={i} className="flex gap-1">
          <input
            value={v}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="flex-1 border border-line rounded-sm px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="text-xs text-steel-500 px-2"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, ""])}
        className="text-xs text-[var(--blue)] underline"
      >
        + Add
      </button>
    </div>
  );
}

function GasTestInput({
  value,
  onChange,
}: {
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}) {
  const fields: Array<[string, string]> = [
    ["o2Percent", "O2 %"],
    ["lelPercent", "LEL %"],
    ["h2sPpm", "H2S ppm"],
    ["coPpm", "CO ppm"],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {fields.map(([key, label]) => (
        <div key={key}>
          <label className="block text-[10px] text-steel-500 mb-0.5">{label}</label>
          <input
            type="number"
            value={value[key] ?? ""}
            onChange={(e) =>
              onChange({ ...value, [key]: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            className="w-full border border-line rounded-sm px-2 py-1.5 text-sm"
          />
        </div>
      ))}
    </div>
  );
}
