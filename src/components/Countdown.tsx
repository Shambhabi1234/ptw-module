"use client";

import { useEffect, useState } from "react";

export function Countdown({ to, prefix = "Expires" }: { to: string; prefix?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const target = new Date(to).getTime();
  const diffMs = target - now;
  const isPast = diffMs <= 0;
  const isSoon = !isPast && diffMs < 2 * 60 * 60 * 1000;

  const absMs = Math.abs(diffMs);
  const hours = Math.floor(absMs / (60 * 60 * 1000));
  const minutes = Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000));
  const text = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <span
      className="text-xs font-medium"
      style={{ color: isPast ? "var(--red)" : isSoon ? "var(--orange)" : "var(--steel-500)" }}
    >
      {isPast ? `Overdue by ${text}` : `${prefix} in ${text}`}
    </span>
  );
}
