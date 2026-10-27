import { createMiddleware } from "hono/factory";
import type { User } from "@/db/schema";
import { createUserRepository } from "@/repositories/user-repository";
import { getDb } from "@/db";
import { errorBody } from "@/lib/error";
import { getAccessToken } from "@/lib/session";
import { verifyAccessToken } from "@/lib/tokens";

// Object-literal type alias (not interface) so it is assignable to hono's
// `Record<string, unknown>` Bindings.
type AppBindings = {
	JWT_SECRET: string;
	finance_application: D1Database;
};

export interface AuthEnv {
	Bindings: AppBindings;
	Variables: { user: User };
}

const UNAUTHENTICATED_ERROR = errorBody(
	"UNAUTHENTICATED",
	"Authentication required",
);

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
	const token = getAccessToken(c);
	if (!token) {
		return c.json(UNAUTHENTICATED_ERROR, 401);
	}
	const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
	if (!payload) {
		return c.json(UNAUTHENTICATED_ERROR, 401);
	}
	const user = await createUserRepository(getDb(c.env)).findById(payload.sub);
	if (!user) {
		return c.json(UNAUTHENTICATED_ERROR, 401);
	}
	c.set("user", user);
	await next();
});
