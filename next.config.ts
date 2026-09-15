import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Bounded resilience campaigns run beside a developer's existing `pnpm dev`.
  // A dedicated cache avoids Next's one-dev-server-per-.next lock.
  distDir: process.env.RESILIENCE_TEST === "1" ? ".next-resilience" : undefined,
  allowedDevOrigins: process.env.RESILIENCE_TEST === "1" ? ["127.0.0.1"] : undefined,
};

export default nextConfig;
