import { z } from "@hono/zod-openapi";

export const greetParamsSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.openapi({
			param: { name: "name", in: "path" },
			description: "Name to greet",
		}),
});

export const greetQuerySchema = z.object({
	greeting: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.default("Hello")
		.openapi({
			param: { name: "greeting", in: "query" },
			description: "Greeting word to place before the name",
			example: "Namaste",
		}),
	times: z.coerce
		.number()
		.int()
		.min(1)
		.max(10)
		.default(1)
		.openapi({
			param: { name: "times", in: "query" },
			description: "How many greeting messages to return (1-10)",
			example: 3,
		}),
});

export const greetResponseSchema = z.object({
	messages: z.array(z.string()),
});

export type GreetParams = z.infer<typeof greetParamsSchema>;
export type GreetQuery = z.infer<typeof greetQuerySchema>;
export type GreetResponse = z.infer<typeof greetResponseSchema>;
