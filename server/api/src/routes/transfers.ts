import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { activityItemSchema } from "@finance-application/schemas";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { requireAuth } from "@/middleware/auth";
import { createActivityRepository } from "@/repositories/activity-repository";
import { createAccountRepository } from "@/repositories/account-repository";
import { createTransferRepository } from "@/repositories/transfer-repository";
import { errorEnvelopeSchema } from "@/schemas/auth";
import {
	activityListQuerySchema,
	activityListResponseSchema,
	createTransferBodySchema,
	restoreTransferBodySchema,
	transferListQuerySchema,
	transferListResponseSchema,
	transferResponseSchema,
	updateTransferBodySchema,
} from "@/schemas/transfers";
import { createAccountService } from "@/services/account-service";
import {
	createTransferService,
	type TransitionTransferOutcome,
	type TransferService,
} from "@/services/transfer-service";

type AppBindings = { JWT_SECRET: string; finance_application: D1Database };

function createTransferServiceForEnv(env: AppBindings): TransferService {
	const db = getDb(env);
	return createTransferService({
		transfers: createTransferRepository(db),
		accounts: createAccountRepository(db),
	});
}

const SAME_ACCOUNT_MESSAGE =
	"Transfers require two different accounts; source and destination must differ";
const ACCOUNT_INELIGIBLE_MESSAGE =
	"Transfers require active accounts; archived or deleted accounts cannot be used";
const TRANSFER_NOT_FOUND = errorBody("NOT_FOUND", "Transfer not found");
const TRANSITION_INVALID_MESSAGE =
	"That transfer lifecycle change is not allowed";
const NOT_EDITABLE_MESSAGE = "Archived or deleted transfers cannot be edited";
const RESTORE_CONFLICT_MESSAGE =
	"The transfer's account has been deleted; reassign it to restore";

const paramsSchema = z.object({ id: z.string().min(1) });

const createTransferRoute = createRoute({
	method: "post",
	path: "/api/transfers",
	request: {
		body: {
			content: { "application/json": { schema: createTransferBodySchema } },
			required: true,
		},
	},
	responses: {
		// 201 for a fresh creation, 200 when the client-generated id replays an
		// existing transfer (idempotent retry).
		201: {
			content: { "application/json": { schema: transferResponseSchema } },
			description: "Transfer created with paired balance effects",
		},
		200: {
			content: { "application/json": { schema: transferResponseSchema } },
			description: "Transfer with this id already exists (idempotent replay)",
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
			description: "Identical source and destination, or ineligible accounts",
		},
	},
});

const listTransfersRoute = createRoute({
	method: "get",
	path: "/api/transfers",
	request: {
		query: transferListQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transferListResponseSchema } },
			description:
				"Paginated transfers matching the filters, oldest page last by date",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

const getTransferRoute = createRoute({
	method: "get",
	path: "/api/transfers/:id",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transferResponseSchema } },
			description: "Transfer details",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transfer for the authenticated user",
		},
	},
});

const updateTransferRoute = createRoute({
	method: "patch",
	path: "/api/transfers/:id",
	request: {
		params: paramsSchema,
		body: {
			content: { "application/json": { schema: updateTransferBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: transferResponseSchema } },
			description: "Transfer updated; balances re-derived atomically",
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
			description: "No such transfer for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Ineligible accounts, identical sides, or the transfer is not active",
		},
	},
});

const archiveTransferRoute = createRoute({
	method: "post",
	path: "/api/transfers/:id/archive",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transferResponseSchema } },
			description: "Transfer archived (balance effects preserved)",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transfer for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Transition not allowed from the transfer's current status",
		},
	},
});

const deleteTransferRoute = createRoute({
	method: "post",
	path: "/api/transfers/:id/delete",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transferResponseSchema } },
			description: "Transfer soft-deleted (restorable from trash)",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transfer for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Transition not allowed from the transfer's current status",
		},
	},
});

const restoreTransferRoute = createRoute({
	method: "post",
	path: "/api/transfers/:id/restore",
	request: {
		params: paramsSchema,
		body: {
			content: {
				"application/json": { schema: restoreTransferBodySchema.optional() },
			},
			required: false,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: transferResponseSchema } },
			description: "Transfer restored to active with effects re-applied once",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transfer for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Transition not allowed, a referenced account was deleted (reassign to restore), or the sides collapse into one account",
		},
	},
});

const permanentlyDeleteTransferRoute = createRoute({
	method: "delete",
	path: "/api/transfers/:id",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transferResponseSchema } },
			description: "Transfer permanently removed",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transfer for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Only soft-deleted transfers can be permanently removed",
		},
	},
});

// Unified history: account-scoped transactions interleaved with both legs of
// every transfer, direction-tagged. The optional accountId query filter scopes
// the feed to one account's perspective; unscoped, every transfer contributes
// both of its legs.
const accountActivityRoute = createRoute({
	method: "get",
	path: "/api/activity",
	request: {
		query: activityListQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: activityListResponseSchema } },
			description:
				"Paginated history with transactions and transfer legs, scoped to the accountId filter when present",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "The accountId filter names no account of the user",
		},
	},
});

export const transfersRoutes = new OpenAPIHono<{
	Bindings: AppBindings;
	Variables: { user: User };
}>({
	defaultHook: validationHook,
});

// Auth applies to every transfer endpoint; both patterns cover the collection
// and the item paths. The activity route guards itself separately.
transfersRoutes.use("/api/transfers", requireAuth);
transfersRoutes.use("/api/transfers/*", requireAuth);
transfersRoutes.use("/api/activity", requireAuth);

transfersRoutes.openapi(createTransferRoute, async (c) => {
	const body = c.req.valid("json");
	const outcome = await createTransferServiceForEnv(c.env).create({
		userId: c.get("user").id,
		...body,
	});
	if (!outcome.ok) {
		return c.json(
			errorBody(
				outcome.code,
				outcome.code === "SAME_ACCOUNT_TRANSFER"
					? SAME_ACCOUNT_MESSAGE
					: ACCOUNT_INELIGIBLE_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, outcome.replayed ? 200 : 201);
});

transfersRoutes.openapi(listTransfersRoute, async (c) => {
	const filters = c.req.valid("query");
	const list = await createTransferServiceForEnv(c.env).list(
		c.get("user").id,
		filters,
	);
	return c.json(list, 200);
});

transfersRoutes.openapi(getTransferRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createTransferServiceForEnv(c.env).get(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(TRANSFER_NOT_FOUND, 404);
	}
	return c.json(outcome.value, 200);
});

transfersRoutes.openapi(updateTransferRoute, async (c) => {
	const { id } = c.req.valid("param");
	const patch = c.req.valid("json");
	const outcome = await createTransferServiceForEnv(c.env).update({
		userId: c.get("user").id,
		transferId: id,
		...patch,
	});
	if (!outcome.ok) {
		return c.json(
			errorBody(
				outcome.code,
				outcome.code === "SAME_ACCOUNT_TRANSFER"
					? SAME_ACCOUNT_MESSAGE
					: outcome.code === "ACCOUNT_INELIGIBLE"
						? ACCOUNT_INELIGIBLE_MESSAGE
						: NOT_EDITABLE_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, 200);
});

transfersRoutes.openapi(archiveTransferRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createTransferServiceForEnv(c.env).archive(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

transfersRoutes.openapi(deleteTransferRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createTransferServiceForEnv(c.env).remove(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

transfersRoutes.openapi(restoreTransferRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const outcome = await createTransferServiceForEnv(c.env).restore({
		userId: c.get("user").id,
		transferId: id,
		sourceAccountId: body?.sourceAccountId,
		destinationAccountId: body?.destinationAccountId,
	});
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

transfersRoutes.openapi(permanentlyDeleteTransferRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createTransferServiceForEnv(c.env).destroy(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

transfersRoutes.openapi(accountActivityRoute, async (c) => {
	const userId = c.get("user").id;
	const filters = c.req.valid("query");
	const db = getDb(c.env);
	// When the filter names an account, ownership runs through the account
	// service so an unknown or foreign account is a plain NOT_FOUND.
	if (filters.accountId) {
		const accountService = createAccountService({
			accounts: createAccountRepository(db),
		});
		const account = await accountService.get(userId, filters.accountId);
		if (!account.ok) {
			return c.json(errorBody("NOT_FOUND", "Account not found"), 404);
		}
	}
	const list = await createActivityRepository(db).list(userId, filters);
	return c.json(
		{
			// Parsing through the shared schema keeps the response types honest
			// without unsafe casts, the same way the services build their views.
			activity: list.rows.map((row) => activityItemSchema.parse(row)),
			page: filters.page,
			pageSize: filters.pageSize,
			total: list.total,
		},
		200,
	);
});

function transitionErrorStatus(
	outcome: Extract<TransitionTransferOutcome, { ok: false }>,
): 404 | 409 {
	return outcome.code === "NOT_FOUND" ? 404 : 409;
}

function transitionErrorBody(
	outcome: Extract<TransitionTransferOutcome, { ok: false }>,
): ReturnType<typeof errorBody> {
	if (outcome.code === "NOT_FOUND") {
		return TRANSFER_NOT_FOUND;
	}
	return errorBody(
		outcome.code,
		outcome.code === "RESTORE_CONFLICT"
			? RESTORE_CONFLICT_MESSAGE
			: outcome.code === "SAME_ACCOUNT_TRANSFER"
				? SAME_ACCOUNT_MESSAGE
				: TRANSITION_INVALID_MESSAGE,
	);
}
