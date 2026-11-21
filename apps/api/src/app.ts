import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { User } from "@/db/schema";
import { internalErrorBody, notFoundBody } from "@/lib/error";
import { accountsRoutes } from "@/routes/accounts";
import { authRoutes } from "@/routes/auth";
import { categoriesRoutes } from "@/routes/categories";
import { greetRoutes } from "@/routes/greet";
import { helloRoutes } from "@/routes/hello";
import { preferencesRoutes } from "@/routes/preferences";
import { recurringExpensesRoutes } from "@/routes/recurring-expenses";
import { reportsRoutes } from "@/routes/reports";
import { transactionsRoutes } from "@/routes/transactions";
import { transfersRoutes } from "@/routes/transfers";

type AppEnv = {
	Variables: { user: User };
	Bindings: { DOCS_ENABLED?: string };
};

export const app = new OpenAPIHono<AppEnv>();

// No API response is cacheable: authenticated financial data and error
// envelopes must never be stored by a browser or intermediary cache.
app.use("/api/*", async (c, next) => {
	await next();
	c.header("Cache-Control", "no-store");
});

app.route("/", helloRoutes);
app.route("/", greetRoutes);
app.route("/", authRoutes);
app.route("/", accountsRoutes);
app.route("/", categoriesRoutes);
app.route("/", transactionsRoutes);
app.route("/", recurringExpensesRoutes);
app.route("/", transfersRoutes);
app.route("/", preferencesRoutes);
app.route("/", reportsRoutes);

// Self-documentation is configuration-gated: enabled in local development
// (DOCS_ENABLED=true in .dev.vars), disabled in production by default. When
// disabled, both paths answer the standard 404 envelope, indistinguishable
// from any other unknown route. The middleware registers before the doc
// routes so it intercepts them.
const DOCS_NOT_FOUND = notFoundBody();
const docsEnabled = (c: { env?: { DOCS_ENABLED?: string } }): boolean =>
	c.env?.DOCS_ENABLED === "true";
app.use("/api/openapi", async (c, next) => {
	if (!docsEnabled(c)) {
		return c.json(DOCS_NOT_FOUND, 404);
	}
	await next();
});
app.use("/api/docs", async (c, next) => {
	if (!docsEnabled(c)) {
		return c.json(DOCS_NOT_FOUND, 404);
	}
	await next();
});

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
	// Only the error type and message reach the logs — never a full error
	// object, which could carry driver-level SQL text or bound values.
	console.error(
		error instanceof Error ? `${error.name}: ${error.message}` : error,
	);
	return c.json(internalErrorBody(), 500);
});
