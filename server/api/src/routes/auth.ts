import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
	clearSession,
	getRefreshToken,
	issueSession,
} from "@/lib/session";
import {
	generateRefreshToken,
	hashToken,
	signAccessToken,
} from "@/lib/tokens";
import { requireAuth } from "@/middleware/auth";
import { createRefreshTokenRepository } from "@/repositories/refresh-token-repository";
import { createUserRepository } from "@/repositories/user-repository";
import { createAuthService } from "@/services/auth-service";
import {
	errorEnvelopeSchema,
	loginBodySchema,
	registerBodySchema,
	userResponseSchema,
} from "@/schemas/auth";

function createAuthServiceForEnv(env: {
	JWT_SECRET: string;
	finance_application: D1Database;
}) {
	const db = getDb(env);
	return createAuthService({
		users: createUserRepository(db),
		refreshTokens: createRefreshTokenRepository(db),
		jwtSecret: env.JWT_SECRET,
		hashPassword,
		verifyPassword,
		signAccessToken,
		generateRefreshToken,
		hashToken,
	});
}

const registerRoute = createRoute({
	method: "post",
	path: "/api/auth/register",
	request: {
		body: {
			content: { "application/json": { schema: registerBodySchema } },
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: userResponseSchema } },
			description: "Account created; session cookies set",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Email already registered",
		},
	},
});

const loginRoute = createRoute({
	method: "post",
	path: "/api/auth/login",
	request: {
		body: {
			content: { "application/json": { schema: loginBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: userResponseSchema } },
			description: "Session established",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Invalid credentials",
		},
	},
});

const meRoute = createRoute({
	method: "get",
	path: "/api/auth/me",
	responses: {
		200: {
			content: { "application/json": { schema: userResponseSchema } },
			description: "Authenticated user",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

const refreshRoute = createRoute({
	method: "post",
	path: "/api/auth/refresh",
	responses: {
		200: {
			content: { "application/json": { schema: userResponseSchema } },
			description: "Session rotated",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Absent, unknown, expired, or revoked refresh token",
		},
	},
});

const logoutRoute = createRoute({
	method: "post",
	path: "/api/auth/logout",
	responses: {
		204: { description: "Session revoked and cookies cleared" },
	},
});

export const authRoutes = new OpenAPIHono<{
	Bindings: { JWT_SECRET: string; finance_application: D1Database };
	Variables: { user: User };
}>({
	defaultHook: validationHook,
});

authRoutes.openapi(registerRoute, async (c) => {
	const { email, password } = c.req.valid("json");
	const outcome = await createAuthServiceForEnv(c.env).register({
		email,
		password,
	});
	if (!outcome.ok) {
		return c.json(errorBody(outcome.code, "Email is already registered"), 409);
	}
	issueSession(c, outcome.value.accessToken, outcome.value.refreshToken);
	return c.json({ id: outcome.value.id, email: outcome.value.email }, 201);
});

authRoutes.openapi(loginRoute, async (c) => {
	const { email, password } = c.req.valid("json");
	const outcome = await createAuthServiceForEnv(c.env).login({
		email,
		password,
	});
	if (!outcome.ok) {
		return c.json(errorBody(outcome.code, "Invalid email or password"), 401);
	}
	issueSession(c, outcome.value.accessToken, outcome.value.refreshToken);
	return c.json({ id: outcome.value.id, email: outcome.value.email }, 200);
});

authRoutes.use("/api/auth/me", requireAuth);

authRoutes.openapi(meRoute, (c) => {
	const user = c.get("user");
	return c.json({ id: user.id, email: user.email }, 200);
});

authRoutes.openapi(refreshRoute, async (c) => {
	const outcome = await createAuthServiceForEnv(c.env).refresh(
		getRefreshToken(c),
	);
	if (!outcome.ok) {
		return c.json(errorBody(outcome.code, "Invalid refresh token"), 401);
	}
	issueSession(c, outcome.value.accessToken, outcome.value.refreshToken);
	return c.json({ id: outcome.value.id, email: outcome.value.email }, 200);
});

authRoutes.openapi(logoutRoute, async (c) => {
	await createAuthServiceForEnv(c.env).logout(getRefreshToken(c));
	clearSession(c);
	return c.body(null, 204);
});
