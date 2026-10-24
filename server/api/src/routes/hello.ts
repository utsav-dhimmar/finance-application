import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { validationHook } from "@/lib/error";

const helloResponseSchema = z.object({ message: z.string() });

const helloRoute = createRoute({
	method: "get",
	path: "/api/hello",
	responses: {
		200: {
			content: { "application/json": { schema: helloResponseSchema } },
			description: "A fixed hello-world message",
		},
	},
});

export const helloRoutes = new OpenAPIHono({ defaultHook: validationHook });

helloRoutes.openapi(helloRoute, (c) => {
	return c.json({ message: "Hello, World!" }, 200);
});
