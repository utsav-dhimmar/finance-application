import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export type Db = DrizzleD1Database<typeof schema>;

export function getDb(env: Env): Db {
	return drizzle(env.finance_application, { schema });
}
