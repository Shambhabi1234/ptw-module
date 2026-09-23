import { STATUS_LABEL, STATUS_COLOR } from "@/lib/permitDisplay";

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? { fg: "var(--grey)", bg: "var(--grey-bg)" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm border"
      style={{ color: color.fg, background: color.bg, borderColor: color.fg + "33" }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
