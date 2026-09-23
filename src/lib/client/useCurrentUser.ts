"use client";

import { useEffect, useState, useCallback } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "REQUESTER" | "AREA_OWNER" | "SAFETY_OFFICER" | "ADMIN";
}

export function useCurrentUser() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setError("Could not reach the server.");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { user, loading: user === undefined, error, reload };
}
