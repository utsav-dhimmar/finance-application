import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";

// Wiring only: schema and migrations arrive with the first persistence change.
export function getDb(env: Env): DrizzleD1Database<Record<string, never>> {
	return drizzle(env.DB);
}
