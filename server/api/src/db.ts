import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export function getDb(env: Env): DrizzleD1Database<typeof schema> {
	return drizzle(env.finance_application, { schema });
}
