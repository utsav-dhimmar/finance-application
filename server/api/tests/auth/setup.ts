import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { inject } from "vitest";

// Applies the drizzle-generated migrations before every auth test file.
await applyD1Migrations(env.finance_application, inject("d1Migrations"));
