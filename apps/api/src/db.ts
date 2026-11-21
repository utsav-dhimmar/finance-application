import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export type Db = DrizzleD1Database<typeof schema>;

export type DbEnv = {
	finance_application: D1Database;
};
export function getDb(env: DbEnv): Db {
	return drizzle(env.finance_application, { schema });
}
