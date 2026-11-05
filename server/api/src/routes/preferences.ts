import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { requireAuth } from "@/middleware/auth";
import { createPreferenceRepository } from "@/repositories/preference-repository";
import { errorEnvelopeSchema } from "@/schemas/auth";
import {
	preferencesResponseSchema,
	updatePreferencesBodySchema,
} from "@/schemas/preferences";
import {
	createPreferenceService,
	type PreferenceService,
} from "@/services/preference-service";

type AppBindings = { JWT_SECRET: string; finance_application: D1Database };

function createPreferenceServiceForEnv(env: AppBindings): PreferenceService {
	return createPreferenceService({
		preferences: createPreferenceRepository(getDb(env)),
	});
}

const UNSUPPORTED_CURRENCY_MESSAGE = "That display currency is not supported";

const getPreferencesRoute = createRoute({
	method: "get",
	path: "/api/preferences",
	responses: {
		200: {
			content: { "application/json": { schema: preferencesResponseSchema } },
			description: "The user's preferences with defaults applied on first read",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

const updatePreferencesRoute = createRoute({
	method: "patch",
	path: "/api/preferences",
	request: {
		body: {
			content: { "application/json": { schema: updatePreferencesBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: preferencesResponseSchema } },
			description: "Preferences updated",
		},
		400: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Request validation failed, or the currency is unsupported",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

export const preferencesRoutes = new OpenAPIHono<{
	Bindings: AppBindings;
	Variables: { user: User };
}>({
	defaultHook: validationHook,
});

// Auth applies to every preferences endpoint; both patterns cover the
// collection path and any future subpaths.
preferencesRoutes.use("/api/preferences", requireAuth);
preferencesRoutes.use("/api/preferences/*", requireAuth);

preferencesRoutes.openapi(getPreferencesRoute, async (c) => {
	const view = await createPreferenceServiceForEnv(c.env).read(
		c.get("user").id,
	);
	return c.json(view, 200);
});

preferencesRoutes.openapi(updatePreferencesRoute, async (c) => {
	const body = c.req.valid("json");
	const outcome = await createPreferenceServiceForEnv(c.env).update({
		userId: c.get("user").id,
		currencyCode: body.currencyCode,
	});
	if (!outcome.ok) {
		return c.json(errorBody(outcome.code, UNSUPPORTED_CURRENCY_MESSAGE), 400);
	}
	return c.json(outcome.value, 200);
});
