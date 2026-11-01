import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { requireAuth } from "@/middleware/auth";
import { createCategoryRepository } from "@/repositories/category-repository";
import {
	createCategoryService,
	type CategoryService,
	type TransitionCategoryOutcome,
} from "@/services/category-service";
import {
	categoryListResponseSchema,
	categoryResponseSchema,
	createCategoryBodySchema,
	listCategoriesQuerySchema,
	restoreCategoryBodySchema,
	updateCategoryBodySchema,
} from "@/schemas/categories";
import { errorEnvelopeSchema } from "@/schemas/auth";

type AppBindings = { JWT_SECRET: string; finance_application: D1Database };

function createCategoryServiceForEnv(env: AppBindings): CategoryService {
	return createCategoryService({
		categories: createCategoryRepository(getDb(env)),
	});
}

const NAME_TAKEN_MESSAGE = "A category with this name already exists";
const CATEGORY_NOT_FOUND = errorBody("NOT_FOUND", "Category not found");
const TRANSITION_INVALID_MESSAGE =
	"That category lifecycle change is not allowed";
const TYPE_LOCKED_MESSAGE =
	"The category type can no longer be changed because transactions reference it";
const NOT_EDITABLE_MESSAGE = "Archived or deleted categories cannot be edited";

const paramsSchema = z.object({ id: z.string().min(1) });

const createCategoryRoute = createRoute({
	method: "post",
	path: "/api/categories",
	request: {
		body: {
			content: { "application/json": { schema: createCategoryBodySchema } },
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: categoryResponseSchema } },
			description: "Category created",
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
			description: "Name already in use by a non-deleted category",
		},
	},
});

const listCategoriesRoute = createRoute({
	method: "get",
	path: "/api/categories",
	request: {
		query: listCategoriesQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: categoryListResponseSchema } },
			description: "Categories with the requested lifecycle status",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

const getCategoryRoute = createRoute({
	method: "get",
	path: "/api/categories/:id",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: categoryResponseSchema } },
			description: "Category details",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such category for the authenticated user",
		},
	},
});

const updateCategoryRoute = createRoute({
	method: "patch",
	path: "/api/categories/:id",
	request: {
		params: paramsSchema,
		body: {
			content: { "application/json": { schema: updateCategoryBodySchema } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: categoryResponseSchema } },
			description: "Category updated",
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
			description: "No such category for the authenticated user",
		},
		409: {
			content: {
				"application/json": { schema: errorEnvelopeSchema },
			},
			description: "Name conflict, locked type, or the category is not active",
		},
	},
});

const archiveCategoryRoute = createRoute({
	method: "post",
	path: "/api/categories/:id/archive",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: categoryResponseSchema } },
			description: "Category archived",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such category for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Transition not allowed from the category's current status",
		},
	},
});

const deleteCategoryRoute = createRoute({
	method: "post",
	path: "/api/categories/:id/delete",
	request: {
		params: paramsSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: categoryResponseSchema } },
			description: "Category soft-deleted (restorable from trash)",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such category for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Transition not allowed from the category's current status",
		},
	},
});

const restoreCategoryRoute = createRoute({
	method: "post",
	path: "/api/categories/:id/restore",
	request: {
		params: paramsSchema,
		body: {
			content: {
				"application/json": { schema: restoreCategoryBodySchema.optional() },
			},
			required: false,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: categoryResponseSchema } },
			description: "Category restored to active",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
		404: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "No such category for the authenticated user",
		},
		409: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Transition not allowed, or the name is taken (retry with newName)",
		},
	},
});

export const categoriesRoutes = new OpenAPIHono<{
	Bindings: AppBindings;
	Variables: { user: User };
}>({
	defaultHook: validationHook,
});

// Auth applies to every category endpoint; both patterns cover the collection
// and the item paths.
categoriesRoutes.use("/api/categories", requireAuth);
categoriesRoutes.use("/api/categories/*", requireAuth);

categoriesRoutes.openapi(createCategoryRoute, async (c) => {
	const { name, type, color, icon } = c.req.valid("json");
	const outcome = await createCategoryServiceForEnv(c.env).create({
		userId: c.get("user").id,
		name,
		type,
		color,
		icon,
	});
	if (!outcome.ok) {
		return c.json(errorBody(outcome.code, NAME_TAKEN_MESSAGE), 409);
	}
	return c.json(outcome.value, 201);
});

categoriesRoutes.openapi(listCategoriesRoute, async (c) => {
	const { status } = c.req.valid("query");
	const list = await createCategoryServiceForEnv(c.env).list(
		c.get("user").id,
		status,
	);
	return c.json(list, 200);
});

categoriesRoutes.openapi(getCategoryRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createCategoryServiceForEnv(c.env).get(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(CATEGORY_NOT_FOUND, 404);
	}
	return c.json(outcome.value, 200);
});

categoriesRoutes.openapi(updateCategoryRoute, async (c) => {
	const { id } = c.req.valid("param");
	const patch = c.req.valid("json");
	const outcome = await createCategoryServiceForEnv(c.env).update({
		userId: c.get("user").id,
		categoryId: id,
		...patch,
	});
	if (!outcome.ok) {
		return c.json(
			errorBody(
				outcome.code,
				outcome.code === "CATEGORY_NAME_TAKEN"
					? NAME_TAKEN_MESSAGE
					: outcome.code === "CATEGORY_TYPE_LOCKED"
						? TYPE_LOCKED_MESSAGE
						: NOT_EDITABLE_MESSAGE,
			),
			409,
		);
	}
	return c.json(outcome.value, 200);
});

categoriesRoutes.openapi(archiveCategoryRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createCategoryServiceForEnv(c.env).archive(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

categoriesRoutes.openapi(deleteCategoryRoute, async (c) => {
	const { id } = c.req.valid("param");
	const outcome = await createCategoryServiceForEnv(c.env).remove(
		c.get("user").id,
		id,
	);
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

categoriesRoutes.openapi(restoreCategoryRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const outcome = await createCategoryServiceForEnv(c.env).restore({
		userId: c.get("user").id,
		categoryId: id,
		newName: body?.newName,
	});
	if (!outcome.ok) {
		return c.json(transitionErrorBody(outcome), transitionErrorStatus(outcome));
	}
	return c.json(outcome.value, 200);
});

function transitionErrorStatus(
	outcome: Extract<TransitionCategoryOutcome, { ok: false }>,
): 404 | 409 {
	return outcome.code === "NOT_FOUND" ? 404 : 409;
}

function transitionErrorBody(
	outcome: Extract<TransitionCategoryOutcome, { ok: false }>,
): ReturnType<typeof errorBody> {
	if (outcome.code === "NOT_FOUND") {
		return CATEGORY_NOT_FOUND;
	}
	return errorBody(
		outcome.code,
		outcome.code === "CATEGORY_NAME_TAKEN"
			? NAME_TAKEN_MESSAGE
			: TRANSITION_INVALID_MESSAGE,
	);
}
