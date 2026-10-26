import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getDb } from "@/db";
import { refreshTokens, type User, users } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
	clearSession,
	getAccessToken,
	getRefreshToken,
	issueSession,
} from "@/lib/session";
import {
	generateRefreshToken,
	hashToken,
	signAccessToken,
	verifyAccessToken,
} from "@/lib/tokens";
import { uuidV7 } from "@/lib/uuid";
import {
	errorEnvelopeSchema,
	loginBodySchema,
	registerBodySchema,
	userResponseSchema,
} from "@/schemas/auth";

// Object-literal type alias (not interface) so it is assignable to hono's
// `Record<string, unknown>` Bindings.
type AppBindings = {
	JWT_SECRET: string;
	finance_application: D1Database;
};

interface AuthEnv {
	Bindings: AppBindings;
	Variables: { user: User };
}

const GENERIC_CREDENTIALS_ERROR = errorBody(
	"AUTH_INVALID_CREDENTIALS",
	"Invalid email or password",
);
const UNAUTHENTICATED_ERROR = errorBody(
	"UNAUTHENTICATED",
	"Authentication required",
);
const INVALID_REFRESH_ERROR = errorBody(
	"INVALID_REFRESH_TOKEN",
	"Invalid refresh token",
);

function isoNow(): string {
	return new Date().toISOString();
}

function refreshExpiryIso(): string {
	return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
	const token = getAccessToken(c);
	if (!token) {
		return c.json(UNAUTHENTICATED_ERROR, 401);
	}
	const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
	if (!payload) {
		return c.json(UNAUTHENTICATED_ERROR, 401);
	}
	const found = await getDb(c.env)
		.select()
		.from(users)
		.where(eq(users.id, payload.sub))
		.limit(1);
	const user = found[0];
	if (!user) {
		return c.json(UNAUTHENTICATED_ERROR, 401);
	}
	c.set("user", user);
	await next();
});

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

export const authRoutes = new OpenAPIHono<AuthEnv>({
	defaultHook: validationHook,
});

authRoutes.openapi(registerRoute, async (c) => {
	const { email, password } = c.req.valid("json");
	const db = getDb(c.env);

	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);
	if (existing.length > 0) {
		return c.json(errorBody("EMAIL_TAKEN", "Email is already registered"), 409);
	}

	const passwordHash = await hashPassword(password);
	const inserted = await db
		.insert(users)
		.values({
			id: uuidV7(),
			email,
			passwordHash,
			createdAt: isoNow(),
			updatedAt: isoNow(),
		})
		.returning({ id: users.id, email: users.email });
	const user = inserted[0];
	if (!user) {
		// Global onError maps this to a 500 INTERNAL_ERROR envelope.
		throw new Error("user insert returned no rows");
	}

	const [accessToken, refreshToken] = await Promise.all([
		signAccessToken(user.id, c.env.JWT_SECRET),
		createRefreshTokenRecord(db, user.id),
	]);
	issueSession(c, accessToken, refreshToken);
	return c.json({ id: user.id, email: user.email }, 201);
});

authRoutes.openapi(loginRoute, async (c) => {
	const { email, password } = c.req.valid("json");
	const db = getDb(c.env);

	const found = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);
	const user = found[0];
	const passwordMatches =
		user !== undefined && (await verifyPassword(password, user.passwordHash));
	if (user === undefined || !passwordMatches) {
		return c.json(GENERIC_CREDENTIALS_ERROR, 401);
	}

	const [accessToken, refreshToken] = await Promise.all([
		signAccessToken(user.id, c.env.JWT_SECRET),
		createRefreshTokenRecord(db, user.id),
	]);
	issueSession(c, accessToken, refreshToken);
	return c.json({ id: user.id, email: user.email }, 200);
});

authRoutes.use("/api/auth/me", requireAuth);

authRoutes.openapi(meRoute, (c) => {
	const user = c.get("user");
	return c.json({ id: user.id, email: user.email }, 200);
});

authRoutes.openapi(refreshRoute, async (c) => {
	const token = getRefreshToken(c);
	if (!token) {
		return c.json(INVALID_REFRESH_ERROR, 401);
	}
	const db = getDb(c.env);
	const tokenHash = await hashToken(token);

	const found = await db
		.select()
		.from(refreshTokens)
		.where(eq(refreshTokens.tokenHash, tokenHash))
		.limit(1);
	const record = found[0];
	const nowIso = isoNow();
	const isUsable =
		record !== undefined &&
		record.revokedAt === null &&
		record.expiresAt > nowIso;
	if (!isUsable || record === undefined) {
		return c.json(INVALID_REFRESH_ERROR, 401);
	}

	const newRefreshToken = generateRefreshToken();
	const newTokenHash = await hashToken(newRefreshToken);
	await db.batch([
		db
			.update(refreshTokens)
			.set({ revokedAt: nowIso })
			.where(eq(refreshTokens.id, record.id)),
		db.insert(refreshTokens).values({
			id: uuidV7(),
			userId: record.userId,
			tokenHash: newTokenHash,
			expiresAt: refreshExpiryIso(),
			revokedAt: null,
			createdAt: nowIso,
		}),
	]);

	const accessToken = await signAccessToken(record.userId, c.env.JWT_SECRET);
	issueSession(c, accessToken, newRefreshToken);
	const user = await db
		.select()
		.from(users)
		.where(eq(users.id, record.userId))
		.limit(1);
	const foundUser = user[0];
	if (!foundUser) {
		return c.json(INVALID_REFRESH_ERROR, 401);
	}
	return c.json({ id: foundUser.id, email: foundUser.email }, 200);
});

authRoutes.openapi(logoutRoute, async (c) => {
	const token = getRefreshToken(c);
	if (token) {
		const db = getDb(c.env);
		const tokenHash = await hashToken(token);
		await db
			.update(refreshTokens)
			.set({ revokedAt: isoNow() })
			.where(eq(refreshTokens.tokenHash, tokenHash));
	}
	clearSession(c);
	return c.body(null, 204);
});

async function createRefreshTokenRecord(
	db: ReturnType<typeof getDb>,
	userId: string,
): Promise<string> {
	const token = generateRefreshToken();
	const tokenHash = await hashToken(token);
	await db.insert(refreshTokens).values({
		id: uuidV7(),
		userId,
		tokenHash,
		expiresAt: refreshExpiryIso(),
		revokedAt: null,
		createdAt: isoNow(),
	});
	return token;
}
