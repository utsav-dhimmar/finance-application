import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { requireAuth } from "@/middleware/auth";
import { createAccountRepository } from "@/repositories/account-repository";
import {
	createAccountService,
	type AccountService,
	type TransitionAccountOutcome,
} from "@/services/account-service";
import {
	accountListResponseSchema,
	accountResponseSchema,
	createAccountBodySchema,
	listAccountsQuerySchema,
	restoreAccountBodySchema,
	updateAccountBodySchema,
} from "@/schemas/accounts";
import { errorEnvelopeSchema } from "@/schemas/auth";

type AppBindings = { JWT_SECRET: string; finance_application: D1Database };

function createAccountServiceForEnv(env: AppBindings): AccountService {
	return createAccountService({
		accounts: createAccountRepository(getDb(env)),
	});
}

const NAME_TAKEN_MESSAGE = "An account with this name already exists";
const ACCOUNT_NOT_FOUND = errorBody("NOT_FOUND", "Account not found");
const TRANSITION_INVALID_MESSAGE =
	"That account lifecycle change is not allowed";
const LOCKED_FIELDS_MESSAGE =
	"Opening balance and account type can no longer be changed because this account has posted transactions";
const NOT_EDITABLE_MESSAGE = "Archived or deleted accounts cannot be edited";

const paramsSchema = z.object({ id: z.string().min(1) });

const createAccountRoute = createRoute({
	method: "post",
	path: "/api/accounts",
	request: {
		body: {
			content: { "application/json": { schema: createAccountBodySchema } },
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: accountResponseSchema } },
			description: "Account created with its current balance",
		},
		400: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Request validation failed",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Name already in use by a non-deleted account",
		},
	},
});

const listAccountsRoute = createRoute({
	method: "get",
	path: "/api/accounts",
	request: {
		query: listAccountsQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: accountListResponseSchema } },
			description:
				"Accounts with the requested lifecycle status plus the combined balance across active accounts",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

const getAccountRoute = createRoute({
	method: "get",
	path: "/api/accounts/:id",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: accountResponseSchema } },
			description: "Account details with current balance",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such account for the authenticated user",
		},
	},
});

const updateAccountRoute = createRoute({
	method: "patch",
	path: "/api/accounts/:id",
	request: {
		params: paramsSchema,
		body: {
			content: { "application/json": { schema: updateAccountBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: accountResponseSchema } },
			description: "Account updated",
		},
		400: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Request validation failed",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such account for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Name conflict, locked fields, or the account is not active",
		},
	},
});

const archiveAccountRoute = createRoute({
	method: "post",
	path: "/api/accounts/:id/archive",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: accountResponseSchema } },
			description: "Account archived",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such account for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Transition not allowed from the account's current status",
		},
	},
});

const deleteAccountRoute = createRoute({
	method: "post",
	path: "/api/accounts/:id/delete",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: accountResponseSchema } },
			description: "Account soft-deleted (restorable from trash)",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such account for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Transition not allowed from the account's current status",
		},
	},
});

const restoreAccountRoute = createRoute({
	method: "post",
	path: "/api/accounts/:id/restore",
	request: {
		params: paramsSchema,
		body: {
			content: {
				"application/json": { schema: restoreAccountBodySchema.optional() },
			},
			required: false,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: accountResponseSchema } },
			description: "Account restored to active",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such account for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Transition not allowed, or the name is taken (retry with newName)",
		},
	},
});

export const accountsRoutes = new OpenAPIHono<{
	Bindings: AppBindings;
	Variables: { user: User };
}>({
	defaultHook: validationHook,
});

// Auth applies to every account endpoint; both patterns cover the collection
// and the item paths.
accountsRoutes.use("/api/accounts", requireAuth);
accountsRoutes.use("/api/accounts/*", requireAuth);

accountsRoutes.openapi(createAccountRoute, async (c) => {
	const { name, type, openingBalanceMinor } = c.req.valid("json");
	const outcome = await createAccountServiceForEnv(c.env).create({
		userId: c.get("user").id,
		name,
		type,
		openingBalanceMinor,
	});
	if (!outcome.ok) {
		return c.json(errorBody(outcome.code, NAME_TAKEN_MESSAGE), 409);
	}
	return c.json(outcome.value, 201);
});

accountsRoutes.openapi(listAccountsRoute, async (c) => {
	const { status } = c.req.valid("query");
	const list = await createAccountServiceForEnv(c.env).list(
		c.get("user").id,
		status,
	);
	return c.json(list, 200);
});

accountsRoutes.openapi(getAccountRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createAccountServiceForEnv(c.env).get(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(ACCOUNT_NOT_FOUND, 404);
	}
	return c.json(outcome.value, 200);
});

accountsRoutes.openapi(updateAccountRoute, async (c) => {
	const { id } = c.req.valid("param");
	const patch = c.req.valid("json");
	const outcome = await createAccountServiceForEnv(c.env).update({
		userId: c.get("user").id,
		accountId: id,
		...patch,
	});
	if (!outcome.ok) {
		return c.json(
			errorBody(
				outcome.code,
				outcome.code === "ACCOUNT_NAME_TAKEN"
					? NAME_TAKEN_MESSAGE
					: outcome.code === "ACCOUNT_FIELD_LOCKED"
						? LOCKED_FIELDS_MESSAGE
						: NOT_EDITABLE_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, 200);
});

accountsRoutes.openapi(archiveAccountRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createAccountServiceForEnv(c.env).archive(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

accountsRoutes.openapi(deleteAccountRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createAccountServiceForEnv(c.env).remove(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

accountsRoutes.openapi(restoreAccountRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const outcome = await createAccountServiceForEnv(c.env).restore({
		userId: c.get("user").id,
		accountId: id,
		newName: body?.newName,
	});
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

function transitionErrorStatus(
	outcome: Extract<TransitionAccountOutcome, { ok: false }>,
): 404 | 409 {
	return outcome.code === "NOT_FOUND" ? 404 : 409;
}

function transitionErrorBody(
	outcome: Extract<TransitionAccountOutcome, { ok: false }>,
): ReturnType<typeof errorBody> {
	if (outcome.code === "NOT_FOUND") {
		return ACCOUNT_NOT_FOUND;
	}
	return errorBody(
		outcome.code,
		outcome.code === "ACCOUNT_NAME_TAKEN"
			? NAME_TAKEN_MESSAGE
			: TRANSITION_INVALID_MESSAGE,
	);
}
