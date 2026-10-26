import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { User } from "@/db/schema";
import { internalErrorBody, notFoundBody } from "@/lib/error";
import { authRoutes } from "@/routes/auth";
import { greetRoutes } from "@/routes/greet";
import { helloRoutes } from "@/routes/hello";

export const app = new OpenAPIHono<{ Variables: { user: User } }>();

app.route("/", helloRoutes);
app.route("/", greetRoutes);
app.route("/", authRoutes);

app.doc31("/api/openapi", {
	openapi: "3.1.0",
	info: {
		title: "Finance Application API",
		version: "0.1.0",
	},
});

app.get("/api/docs", Scalar({ url: "/api/openapi" }));

app.notFound((c) => c.json(notFoundBody(), 404));

app.onError((error, c) => {
	console.error(error);
	return c.json(internalErrorBody(), 500);
});
