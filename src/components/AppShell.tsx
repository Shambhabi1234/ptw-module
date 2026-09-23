"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/client/useCurrentUser";
import { ROLE_LABEL } from "@/lib/permitDisplay";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-steel-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") router.replace("/login");
    return null;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-charcoal text-steel-100">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-sm">
              Opmaint <span className="text-steel-300 font-normal">/ Permit to Work</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              <Link
                href="/"
                className={pathname === "/" ? "text-white" : "text-steel-300 hover:text-white"}
              >
                Dashboard
              </Link>
              {(user.role === "REQUESTER" || user.role === "ADMIN") && (
                <Link
                  href="/permits/new"
                  className={pathname === "/permits/new" ? "text-white" : "text-steel-300 hover:text-white"}
                >
                  New permit
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-steel-300">
              {user.name} <span className="text-steel-500">· {ROLE_LABEL[user.role]}</span>
            </span>
            <button
              onClick={logout}
              className="text-steel-300 hover:text-white border border-steel-700 rounded-sm px-2 py-1 text-xs"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-steel-50">
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
