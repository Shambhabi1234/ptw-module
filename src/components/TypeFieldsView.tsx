import { getPermitTypeDef } from "@/lib/permitTypes";
import type { PermitType } from "@prisma/client";

function displayValue(kind: string, value: any): string {
  if (value === undefined || value === null || value === "") return "—";
  if (kind === "boolean") return value ? "Yes" : "No";
  if (kind === "stringArray") return Array.isArray(value) && value.length ? value.join(", ") : "—";
  if (kind === "gasTest") {
    if (!value || typeof value !== "object") return "—";
    const parts = [
      value.o2Percent !== undefined ? `O2 ${value.o2Percent}%` : null,
      value.lelPercent !== undefined ? `LEL ${value.lelPercent}%` : null,
      value.h2sPpm !== undefined ? `H2S ${value.h2sPpm}ppm` : null,
      value.coPpm !== undefined ? `CO ${value.coPpm}ppm` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Not recorded";
  }
  if (kind === "select") return String(value).replace(/_/g, " ");
  return String(value);
}

export function TypeFieldsView({ type, values }: { type: PermitType; values: Record<string, any> }) {
  const def = getPermitTypeDef(type);
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
      {def.fields.map((f) => (
        <div key={f.key}>
          <dt className="text-xs text-steel-500">{f.label}</dt>
          <dd className="text-sm text-charcoal mt-0.5">{displayValue(f.kind, values?.[f.key])}</dd>
        </div>
      ))}
    </dl>
  );
}
