export const CAROL_RESILIENCE_TOKEN = "carol-3d-resilience-v1";

export function resilienceTestingEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.RESILIENCE_TEST === "1";
}

export function resilienceUnavailable() {
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}
