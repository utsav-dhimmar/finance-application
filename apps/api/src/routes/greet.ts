import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { validationHook } from "@/lib/error";
import {
	greetParamsSchema,
	greetQuerySchema,
	greetResponseSchema,
} from "@/schemas/greet";

const TAGS = ["Greet"];

const greetRoute = createRoute({
	method: "get",
	path: "/api/greet/{name}",
	tags: TAGS,
	summary: "Greet a user",
	request: {
		params: greetParamsSchema,
		query: greetQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: greetResponseSchema } },
			description: "Greeting messages, one per requested repetition",
		},
	},
});

export const greetRoutes = new OpenAPIHono({ defaultHook: validationHook });

greetRoutes.openapi(greetRoute, (c) => {
	const { name } = c.req.valid("param");
	const { greeting, times } = c.req.valid("query");
	const messages = Array.from({ length: times }, () => `${greeting}, ${name}!`);
	return c.json({ messages }, 200);
});
