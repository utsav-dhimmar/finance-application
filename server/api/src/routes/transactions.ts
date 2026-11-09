import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { requireAuth } from "@/middleware/auth";
import { createAccountRepository } from "@/repositories/account-repository";
import { createCategoryRepository } from "@/repositories/category-repository";
import { createRecurringExpenseRepository } from "@/repositories/recurring-expense-repository";
import { createTransactionRepository } from "@/repositories/transaction-repository";
import { errorEnvelopeSchema } from "@/schemas/auth";
import {
	createTransactionBodySchema,
	listTransactionsQuerySchema,
	restoreTransactionBodySchema,
	transactionListResponseSchema,
	transactionResponseSchema,
	updateTransactionBodySchema,
} from "@/schemas/transactions";
import {
	createTransactionService,
	type TransactionService,
	type TransitionTransactionOutcome,
} from "@/services/transaction-service";

type AppBindings = { JWT_SECRET: string; finance_application: D1Database };

function createTransactionServiceForEnv(env: AppBindings): TransactionService {
	const db = getDb(env);
	return createTransactionService({
		transactions: createTransactionRepository(db),
		accounts: createAccountRepository(db),
		categories: createCategoryRepository(db),
		recurringExpenses: createRecurringExpenseRepository(db),
	});
}

const ACCOUNT_INELIGIBLE_MESSAGE =
	"Transactions require an active account; archived or deleted accounts cannot be used";
const CATEGORY_INELIGIBLE_MESSAGE =
	"Transactions require an active category of the matching type";
const TRANSACTION_NOT_FOUND = errorBody("NOT_FOUND", "Transaction not found");
const TRANSITION_INVALID_MESSAGE =
	"That transaction lifecycle change is not allowed";
const NOT_EDITABLE_MESSAGE =
	"Archived or deleted transactions cannot be edited";
const RESTORE_CONFLICT_MESSAGE =
	"The transaction's account or category has been deleted; reassign it to restore";
const RESTORE_INACTIVE_MESSAGE =
	"The replacement account or category must be active";
const RESTORE_TYPE_MESSAGE =
	"The replacement category's type must match the transaction's type";
const ID_CONFLICT_MESSAGE = "A record with this identifier already exists";

const paramsSchema = z.object({ id: z.string().min(1) });

const createTransactionRoute = createRoute({
	method: "post",
	path: "/api/transactions",
	request: {
		body: {
			content: { "application/json": { schema: createTransactionBodySchema } },
			required: true,
		},
	},
	responses: {
		// 201 for a fresh creation, 200 when the client-generated id replays an
		// existing transaction (idempotent retry).
		201: {
			content: { "application/json": { schema: transactionResponseSchema } },
			description: "Transaction created",
		},
		200: {
			content: { "application/json": { schema: transactionResponseSchema } },
			description:
				"Transaction with this id already exists (idempotent replay)",
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
			description: "Ineligible account or category",
		},
	},
});

const listTransactionsRoute = createRoute({
	method: "get",
	path: "/api/transactions",
	request: {
		query: listTransactionsQuerySchema,
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: transactionListResponseSchema },
			},
			description:
				"Paginated transactions matching the filters, oldest page last by date",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

const getTransactionRoute = createRoute({
	method: "get",
	path: "/api/transactions/:id",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transactionResponseSchema } },
			description: "Transaction details",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transaction for the authenticated user",
		},
	},
});

const updateTransactionRoute = createRoute({
	method: "patch",
	path: "/api/transactions/:id",
	request: {
		params: paramsSchema,
		body: {
			content: { "application/json": { schema: updateTransactionBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: transactionResponseSchema } },
			description: "Transaction updated",
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
			description: "No such transaction for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Ineligible account/category or the transaction is not active",
		},
	},
});

const archiveTransactionRoute = createRoute({
	method: "post",
	path: "/api/transactions/:id/archive",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transactionResponseSchema } },
			description: "Transaction archived (balance effect preserved)",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transaction for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Transition not allowed from the transaction's current status",
		},
	},
});

const deleteTransactionRoute = createRoute({
	method: "post",
	path: "/api/transactions/:id/delete",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transactionResponseSchema } },
			description: "Transaction soft-deleted (restorable from trash)",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transaction for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Transition not allowed from the transaction's current status",
		},
	},
});

const restoreTransactionRoute = createRoute({
	method: "post",
	path: "/api/transactions/:id/restore",
	request: {
		params: paramsSchema,
		body: {
			content: {
				"application/json": { schema: restoreTransactionBodySchema.optional() },
			},
			required: false,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: transactionResponseSchema } },
			description: "Transaction restored to active",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transaction for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Transition not allowed, or the referenced account/category was deleted (reassign to restore)",
		},
	},
});

const permanentlyDeleteTransactionRoute = createRoute({
	method: "delete",
	path: "/api/transactions/:id",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: transactionResponseSchema } },
			description: "Transaction permanently removed",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such transaction for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Only soft-deleted transactions can be permanently removed",
		},
	},
});

export const transactionsRoutes = new OpenAPIHono<{
	Bindings: AppBindings;
	Variables: { user: User };
}>({
	defaultHook: validationHook,
});

// Auth applies to every transaction endpoint; both patterns cover the
// collection and the item paths.
transactionsRoutes.use("/api/transactions", requireAuth);
transactionsRoutes.use("/api/transactions/*", requireAuth);

transactionsRoutes.openapi(createTransactionRoute, async (c) => {
	const body = c.req.valid("json");
	const outcome = await createTransactionServiceForEnv(c.env).create({
		userId: c.get("user").id,
		...body,
	});
	if (!outcome.ok) {
		return c.json(
			errorBody(
				outcome.code,
				outcome.code === "ACCOUNT_INELIGIBLE"
					? ACCOUNT_INELIGIBLE_MESSAGE
					: outcome.code === "CATEGORY_INELIGIBLE"
						? CATEGORY_INELIGIBLE_MESSAGE
						: ID_CONFLICT_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, outcome.replayed ? 200 : 201);
});

transactionsRoutes.openapi(listTransactionsRoute, async (c) => {
	const filters = c.req.valid("query");
	const list = await createTransactionServiceForEnv(c.env).list(
		c.get("user").id,
		filters,
	);
	return c.json(list, 200);
});

transactionsRoutes.openapi(getTransactionRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createTransactionServiceForEnv(c.env).get(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(TRANSACTION_NOT_FOUND, 404);
	}
	return c.json(outcome.value, 200);
});

transactionsRoutes.openapi(updateTransactionRoute, async (c) => {
	const { id } = c.req.valid("param");
	const patch = c.req.valid("json");
	const outcome = await createTransactionServiceForEnv(c.env).update({
		userId: c.get("user").id,
		transactionId: id,
		...patch,
	});
	if (!outcome.ok) {
		return c.json(
			errorBody(
				outcome.code,
				outcome.code === "ACCOUNT_INELIGIBLE"
					? ACCOUNT_INELIGIBLE_MESSAGE
					: outcome.code === "CATEGORY_INELIGIBLE"
						? CATEGORY_INELIGIBLE_MESSAGE
						: NOT_EDITABLE_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, 200);
});

transactionsRoutes.openapi(archiveTransactionRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createTransactionServiceForEnv(c.env).archive(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

transactionsRoutes.openapi(deleteTransactionRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createTransactionServiceForEnv(c.env).remove(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

transactionsRoutes.openapi(restoreTransactionRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const outcome = await createTransactionServiceForEnv(c.env).restore({
		userId: c.get("user").id,
		transactionId: id,
		accountId: body?.accountId,
		categoryId: body?.categoryId,
	});
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

transactionsRoutes.openapi(permanentlyDeleteTransactionRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createTransactionServiceForEnv(c.env).destroy(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

function transitionErrorStatus(
	outcome: Extract<TransitionTransactionOutcome, { ok: false }>,
): 404 | 409 {
	return outcome.code === "NOT_FOUND" ? 404 : 409;
}

function transitionErrorBody(
	outcome: Extract<TransitionTransactionOutcome, { ok: false }>,
): ReturnType<typeof errorBody> {
	if (outcome.code === "NOT_FOUND") {
		return TRANSACTION_NOT_FOUND;
	}
	return errorBody(
		outcome.code,
		outcome.code === "RESTORE_CONFLICT"
			? outcome.reason === "category_type_mismatch"
				? RESTORE_TYPE_MESSAGE
				: outcome.reason === "inactive_replacement"
					? RESTORE_INACTIVE_MESSAGE
					: RESTORE_CONFLICT_MESSAGE
			: TRANSITION_INVALID_MESSAGE,
	);
}
