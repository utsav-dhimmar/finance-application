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
	createRecurringExpenseBodySchema,
	dueRecurringExpensesQuerySchema,
	listRecurringExpensesQuerySchema,
	postDueRecurringExpenseBodySchema,
	postDueResponseSchema,
	recurringExpenseListResponseSchema,
	recurringExpenseResponseSchema,
	updateRecurringExpenseBodySchema,
} from "@/schemas/recurring-expenses";
import {
	createRecurringExpenseService,
	type RecurringExpenseService,
} from "@/services/recurring-expense-service";

type AppBindings = { JWT_SECRET: string; finance_application: D1Database };

function createRecurringExpenseServiceForEnv(
	env: AppBindings,
): RecurringExpenseService {
	const db = getDb(env);
	return createRecurringExpenseService({
		recurringExpenses: createRecurringExpenseRepository(db),
		accounts: createAccountRepository(db),
		categories: createCategoryRepository(db),
		transactions: createTransactionRepository(db),
	});
}

const ACCOUNT_INELIGIBLE_MESSAGE =
	"Recurring expenses require an active account; archived or deleted accounts cannot be used";
const CATEGORY_INELIGIBLE_MESSAGE =
	"Recurring expenses require an active expense category";
const NOT_FOUND_MESSAGE = errorBody(
	"NOT_FOUND",
	"Recurring expense rule not found",
);
const TRANSITION_INVALID_MESSAGE =
	"That recurring expense lifecycle change is not allowed";
const ID_CONFLICT_MESSAGE = "A record with this identifier already exists";

const paramsSchema = z.object({ id: z.string().min(1) });

const createRecurringExpenseRoute = createRoute({
	method: "post",
	path: "/api/recurring-expenses",
	request: {
		body: {
			content: {
				"application/json": {
					schema: createRecurringExpenseBodySchema,
				},
			},
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: recurringExpenseResponseSchema },
			},
			description: "Recurring expense created",
		},
		200: {
			content: {
				"application/json": { schema: recurringExpenseResponseSchema },
			},
			description: "Recurring expense already exists (idempotent replay)",
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
			description: "Ineligible account, category, or identifier conflict",
		},
	},
});

const listRecurringExpensesRoute = createRoute({
	method: "get",
	path: "/api/recurring-expenses",
	request: {
		query: listRecurringExpensesQuerySchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: recurringExpenseListResponseSchema,
				},
			},
			description: "List of recurring expenses matching filters",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

const getDueRecurringExpensesRoute = createRoute({
	method: "get",
	path: "/api/recurring-expenses/due",
	request: {
		query: dueRecurringExpensesQuerySchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: recurringExpenseListResponseSchema,
				},
			},
			description: "Due recurring expenses as of the target cutoff date",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

const getRecurringExpenseRoute = createRoute({
	method: "get",
	path: "/api/recurring-expenses/:id",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: recurringExpenseResponseSchema },
			},
			description: "Recurring expense details",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Not found",
		},
	},
});

const updateRecurringExpenseRoute = createRoute({
	method: "patch",
	path: "/api/recurring-expenses/:id",
	request: {
		params: paramsSchema,
		body: {
			content: {
				"application/json": {
					schema: updateRecurringExpenseBodySchema,
				},
			},
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: recurringExpenseResponseSchema },
			},
			description: "Recurring expense updated",
		},
		400: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Validation failed",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Not found",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Ineligible account or category",
		},
	},
});

const pauseRecurringExpenseRoute = createRoute({
	method: "post",
	path: "/api/recurring-expenses/:id/pause",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: recurringExpenseResponseSchema },
			},
			description: "Recurring expense paused",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Not found",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Invalid state transition",
		},
	},
});

const resumeRecurringExpenseRoute = createRoute({
	method: "post",
	path: "/api/recurring-expenses/:id/resume",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: recurringExpenseResponseSchema },
			},
			description: "Recurring expense resumed",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Not found",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Invalid state transition",
		},
	},
});

const cancelRecurringExpenseRoute = createRoute({
	method: "post",
	path: "/api/recurring-expenses/:id/cancel",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: recurringExpenseResponseSchema },
			},
			description: "Recurring expense cancelled",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Not found",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Invalid state transition",
		},
	},
});

const skipRecurringExpenseRoute = createRoute({
	method: "post",
	path: "/api/recurring-expenses/:id/skip",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: recurringExpenseResponseSchema },
			},
			description: "Occurrence skipped",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Not found",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Invalid state transition",
		},
	},
});

const postDueRecurringExpenseRoute = createRoute({
	method: "post",
	path: "/api/recurring-expenses/:id/post-due",
	request: {
		params: paramsSchema,
		body: {
			content: {
				"application/json": {
					schema: postDueRecurringExpenseBodySchema,
				},
			},
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: postDueResponseSchema },
			},
			description: "Due occurrence posted to ledger",
		},
		400: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Validation failed",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Not found",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Conflict or ineligible target",
		},
	},
});

type AppEnv = {
	Variables: { user: User };
	Bindings: AppBindings;
};

export const recurringExpensesRoutes = new OpenAPIHono<AppEnv>({
	defaultHook: validationHook,
});

recurringExpensesRoutes.use("/api/recurring-expenses/*", requireAuth);
recurringExpensesRoutes.use("/api/recurring-expenses", requireAuth);

recurringExpensesRoutes.openapi(createRecurringExpenseRoute, async (c) => {
	const user = c.get("user");
	const body = c.req.valid("json");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const outcome = await service.create({
		userId: user.id,
		...body,
	});

	if (!outcome.ok) {
		if (outcome.code === "ACCOUNT_INELIGIBLE") {
			return c.json(
				errorBody("ACCOUNT_INELIGIBLE", ACCOUNT_INELIGIBLE_MESSAGE),
				409,
			);
		}
		if (outcome.code === "CATEGORY_INELIGIBLE") {
			return c.json(
				errorBody("CATEGORY_INELIGIBLE", CATEGORY_INELIGIBLE_MESSAGE),
				409,
			);
		}
		return c.json(errorBody("ID_CONFLICT", ID_CONFLICT_MESSAGE), 409);
	}

	return c.json(outcome.value, outcome.replayed ? 200 : 201);
});

recurringExpensesRoutes.openapi(listRecurringExpensesRoute, async (c) => {
	const user = c.get("user");
	const query = c.req.valid("query");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const recurringExpenses = await service.list(user.id, query);
	return c.json({ recurringExpenses }, 200);
});

recurringExpensesRoutes.openapi(getDueRecurringExpensesRoute, async (c) => {
	const user = c.get("user");
	const query = c.req.valid("query");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const recurringExpenses = await service.findDue(user.id, query.asOfDate);
	return c.json({ recurringExpenses }, 200);
});

recurringExpensesRoutes.openapi(getRecurringExpenseRoute, async (c) => {
	const user = c.get("user");
	const { id } = c.req.valid("param");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const outcome = await service.getById(user.id, id);
	if (!outcome.ok) {
		return c.json(NOT_FOUND_MESSAGE, 404);
	}
	return c.json(outcome.value, 200);
});

recurringExpensesRoutes.openapi(updateRecurringExpenseRoute, async (c) => {
	const user = c.get("user");
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const outcome = await service.update({
		userId: user.id,
		id,
		...body,
	});

	if (!outcome.ok) {
		if (outcome.code === "NOT_FOUND") {
			return c.json(NOT_FOUND_MESSAGE, 404);
		}
		if (outcome.code === "ACCOUNT_INELIGIBLE") {
			return c.json(
				errorBody("ACCOUNT_INELIGIBLE", ACCOUNT_INELIGIBLE_MESSAGE),
				409,
			);
		}
		return c.json(
			errorBody("CATEGORY_INELIGIBLE", CATEGORY_INELIGIBLE_MESSAGE),
			409,
		);
	}

	return c.json(outcome.value, 200);
});

recurringExpensesRoutes.openapi(pauseRecurringExpenseRoute, async (c) => {
	const user = c.get("user");
	const { id } = c.req.valid("param");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const outcome = await service.pause(user.id, id);
	if (!outcome.ok) {
		if (outcome.code === "NOT_FOUND") {
			return c.json(NOT_FOUND_MESSAGE, 404);
		}
		return c.json(
			errorBody(
				"RECURRING_EXPENSE_TRANSITION_INVALID",
				TRANSITION_INVALID_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, 200);
});

recurringExpensesRoutes.openapi(resumeRecurringExpenseRoute, async (c) => {
	const user = c.get("user");
	const { id } = c.req.valid("param");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const outcome = await service.resume(user.id, id);
	if (!outcome.ok) {
		if (outcome.code === "NOT_FOUND") {
			return c.json(NOT_FOUND_MESSAGE, 404);
		}
		return c.json(
			errorBody(
				"RECURRING_EXPENSE_TRANSITION_INVALID",
				TRANSITION_INVALID_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, 200);
});

recurringExpensesRoutes.openapi(cancelRecurringExpenseRoute, async (c) => {
	const user = c.get("user");
	const { id } = c.req.valid("param");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const outcome = await service.cancel(user.id, id);
	if (!outcome.ok) {
		if (outcome.code === "NOT_FOUND") {
			return c.json(NOT_FOUND_MESSAGE, 404);
		}
		return c.json(
			errorBody(
				"RECURRING_EXPENSE_TRANSITION_INVALID",
				TRANSITION_INVALID_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, 200);
});

recurringExpensesRoutes.openapi(skipRecurringExpenseRoute, async (c) => {
	const user = c.get("user");
	const { id } = c.req.valid("param");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const outcome = await service.skip(user.id, id);
	if (!outcome.ok) {
		if (outcome.code === "NOT_FOUND") {
			return c.json(NOT_FOUND_MESSAGE, 404);
		}
		return c.json(
			errorBody(
				"RECURRING_EXPENSE_TRANSITION_INVALID",
				TRANSITION_INVALID_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, 200);
});

recurringExpensesRoutes.openapi(postDueRecurringExpenseRoute, async (c) => {
	const user = c.get("user");
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const service = createRecurringExpenseServiceForEnv(c.env);

	const outcome = await service.postDue({
		userId: user.id,
		id,
		...body,
	});

	if (!outcome.ok) {
		if (outcome.code === "NOT_FOUND") {
			return c.json(NOT_FOUND_MESSAGE, 404);
		}
		if (outcome.code === "ACCOUNT_INELIGIBLE") {
			return c.json(
				errorBody("ACCOUNT_INELIGIBLE", ACCOUNT_INELIGIBLE_MESSAGE),
				409,
			);
		}
		if (outcome.code === "CATEGORY_INELIGIBLE") {
			return c.json(
				errorBody("CATEGORY_INELIGIBLE", CATEGORY_INELIGIBLE_MESSAGE),
				409,
			);
		}
		if (outcome.code === "ID_CONFLICT") {
			return c.json(errorBody("ID_CONFLICT", ID_CONFLICT_MESSAGE), 409);
		}
		return c.json(
			errorBody(
				"RECURRING_EXPENSE_TRANSITION_INVALID",
				TRANSITION_INVALID_MESSAGE,
			),
			409,
		);
	}

	return c.json(outcome.value, 201);
});
