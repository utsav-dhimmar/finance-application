import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { verifyPassword } from "@/lib/password";
import {
	allowAuthRequest,
	authClientIp,
	type RateLimitEnv,
} from "@/lib/rate-limit";
import { clearSession, getRefreshToken, issueSession } from "@/lib/session";
import { generateRefreshToken, hashToken, signAccessToken } from "@/lib/tokens";
import { requireAuth } from "@/middleware/auth";
import { createRefreshTokenRepository } from "@/repositories/refresh-token-repository";
import { createUserRepository } from "@/repositories/user-repository";
import {
	errorEnvelopeSchema,
	loginBodySchema,
	userResponseSchema,
} from "@/schemas/auth";
import { createAuthService } from "@/services/auth-service";

type AuthBindings = {
	JWT_SECRET: string;
	finance_application: D1Database;
} & RateLimitEnv;

function createAuthServiceForEnv(env: AuthBindings) {
	const db = getDb(env);
	return createAuthService({
		users: createUserRepository(db),
		refreshTokens: createRefreshTokenRepository(db),
		jwtSecret: env.JWT_SECRET,
		verifyPassword,
		signAccessToken,
		generateRefreshToken,
		hashToken,
	});
}

const RATE_LIMITED_ERROR = errorBody(
	"RATE_LIMITED",
	"Too many requests; try again shortly",
);
const TAGS = ["Auth"];

const loginRoute = createRoute({
	method: "post",
	path: "/api/auth/login",
	tags: TAGS,
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
		429: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Too many login attempts",
		},
	},
});

const meRoute = createRoute({
	method: "get",
	path: "/api/auth/me",
	tags: TAGS,
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
	tags: TAGS,
	responses: {
		200: {
			content: { "application/json": { schema: userResponseSchema } },
			description: "Session rotated",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Absent, unknown, expired, or revoked refresh token",
		},
		429: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Too many refresh attempts",
		},
	},
});

const logoutRoute = createRoute({
	method: "post",
	path: "/api/auth/logout",
	tags: TAGS,
	responses: {
		204: { description: "Session revoked and cookies cleared" },
	},
});

export const authRoutes = new OpenAPIHono<{
	Bindings: AuthBindings;
	Variables: { user: User };
}>({
	defaultHook: validationHook,
});

// Registration is permanently closed (single-user product). The middleware
// answers before body validation runs, so every request — well-formed or not
// — receives the identical response and nothing about existing accounts leaks.
const REGISTRATION_DISABLED_ERROR = errorBody(
	"REGISTRATION_DISABLED",
	"Registration is closed for this application",
);
authRoutes.use("/api/auth/register", async (c) =>
	c.json(REGISTRATION_DISABLED_ERROR, 403),
);

authRoutes.openapi(loginRoute, async (c) => {
	const { email, password } = c.req.valid("json");
	const allowed = await allowAuthRequest(
		c.env,
		`login:${authClientIp(c.req.raw.headers)}:${email}`,
	);
	if (!allowed) {
		return c.json(RATE_LIMITED_ERROR, 429);
	}
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
	const allowed = await allowAuthRequest(
		c.env,
		`refresh:${authClientIp(c.req.raw.headers)}`,
	);
	if (!allowed) {
		return c.json(RATE_LIMITED_ERROR, 429);
	}
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
