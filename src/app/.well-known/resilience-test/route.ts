import { CAROL_RESILIENCE_TOKEN, resilienceTestingEnabled, resilienceUnavailable } from "@/lib/resilience-test";

export const dynamic = "force-dynamic";

export function GET() {
  if (!resilienceTestingEnabled()) return resilienceUnavailable();
  return Response.json(
    { resilienceTest: true, environment: "test", token: CAROL_RESILIENCE_TOKEN },
    { headers: { "Cache-Control": "no-store" } },
  );
}
