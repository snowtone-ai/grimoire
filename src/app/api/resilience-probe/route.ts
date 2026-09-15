import { resilienceTestingEnabled, resilienceUnavailable } from "@/lib/resilience-test";

export const dynamic = "force-dynamic";

export function GET() {
  if (!resilienceTestingEnabled()) return resilienceUnavailable();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
