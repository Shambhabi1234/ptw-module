import { TYPE_LABEL, TYPE_COLOR } from "@/lib/permitDisplay";

export function TypeTag({ type }: { type: string }) {
  const color = TYPE_COLOR[type] ?? "var(--grey)";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-steel-700">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}
