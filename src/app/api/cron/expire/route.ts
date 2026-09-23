import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredPermits } from "@/lib/expiry";

/**
 * Meant to be hit by an external scheduler (Vercel Cron, cron-job.org, a
 * GitHub Action on a schedule — anything that can send an HTTP request on
 * an interval) every few minutes in production, so permits expire even
 * when nobody has the app open. Protected by a shared secret rather than a
 * user session, since it's not a person calling it.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await sweepExpiredPermits();
  return NextResponse.json(result);
}
