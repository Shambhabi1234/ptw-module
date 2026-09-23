"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_LOGINS = [
  { role: "Requester", email: "requester@opmaint.demo" },
  { role: "Area Owner", email: "areaowner@opmaint.demo" },
  { role: "Safety Officer", email: "safety@opmaint.demo" },
  { role: "Admin", email: "admin@opmaint.demo" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not log in.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-steel-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xs uppercase tracking-wider text-steel-500 permit-code mb-1">Opmaint CMMS</div>
          <h1 className="text-xl font-semibold text-charcoal">Permit to Work</h1>
        </div>

        <form onSubmit={submit} className="bg-white border border-line rounded-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-steel-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              placeholder="you@opmaint.demo"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-charcoal text-white text-sm font-medium py-2 rounded-sm disabled:opacity-50"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div className="mt-6 border border-line rounded-sm bg-white p-4">
          <p className="text-xs text-steel-500 mb-2">Demo logins (password: password123)</p>
          <div className="space-y-1">
            {DEMO_LOGINS.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword("password123");
                }}
                className="w-full text-left text-xs px-2 py-1.5 rounded-sm hover:bg-steel-50 flex items-center justify-between"
              >
                <span className="text-charcoal">{d.role}</span>
                <span className="text-steel-500 permit-code">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
