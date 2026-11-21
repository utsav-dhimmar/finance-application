import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@/db";
import type { User } from "@/db/schema";
import { errorBody, validationHook } from "@/lib/error";
import { requireAuth } from "@/middleware/auth";
import { createAccountRepository } from "@/repositories/account-repository";
import { createTransactionRepository } from "@/repositories/transaction-repository";
import { createTransferRepository } from "@/repositories/transfer-repository";
import { errorEnvelopeSchema } from "@/schemas/auth";
import {
	reportPeriodQuerySchema,
	reportSummaryResponseSchema,
} from "@/schemas/reports";
import { createAccountService } from "@/services/account-service";
import { createReportService } from "@/services/report-service";

type AppBindings = { JWT_SECRET: string; finance_application: D1Database };

function createReportServiceForEnv(env: AppBindings) {
	const db = getDb(env);
	const transactionRepository = createTransactionRepository(db);
	const transferRepository = createTransferRepository(db);
	return createReportService({
		transactions: transactionRepository,
		accounts: createAccountService({
			accounts: createAccountRepository(db),
			// The report's balance section is the accounts endpoint's semantics;
			// both derive from the same ledger sums.
			postedSums: {
				forAccount: (accountId) =>
					transactionRepository.sumNonDeletedEffects(accountId),
				byUser: (userId) =>
					transactionRepository.sumNonDeletedEffectsByAccount(userId),
				countForAccount: (accountId) =>
					transactionRepository.countNonDeletedByAccount(accountId),
			},
			transferSums: {
				forAccount: (accountId) =>
					transferRepository.sumNonDeletedEffects(accountId),
				byUser: (userId) =>
					transferRepository.sumNonDeletedEffectsByAccount(userId),
				countForAccount: (accountId) =>
					transferRepository.countNonDeletedByAccount(accountId),
			},
		}),
	});
}

const INVALID_PERIOD_MESSAGE =
	"Provide exactly one of a month (YYYY-MM), a year (YYYY), or a from/to date range";

const reportSummaryRoute = createRoute({
	method: "get",
	path: "/api/reports/summary",
	request: {
		query: reportPeriodQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: reportSummaryResponseSchema } },
			description:
				"Period overview: income, expense, net cash flow, expense breakdown by category, comparison series, and active-account balances",
		},
		400: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description:
				"Malformed period fields, or a period that is not exactly one of month, year, or from/to",
		},
		401: {
			content: { "application/json": { schema: errorEnvelopeSchema } },
			description: "Missing, invalid, or expired access token",
		},
	},
});

export const reportsRoutes = new OpenAPIHono<{
	Bindings: AppBindings;
	Variables: { user: User };
}>({
	defaultHook: validationHook,
});

reportsRoutes.use("/api/reports", requireAuth);
reportsRoutes.use("/api/reports/*", requireAuth);

reportsRoutes.openapi(reportSummaryRoute, async (c) => {
	const period = c.req.valid("query");
	const outcome = await createReportServiceForEnv(c.env).summary(
		c.get("user").id,
		period,
	);
	if (!outcome.ok) {
		return c.json(errorBody("INVALID_PERIOD", INVALID_PERIOD_MESSAGE), 400);
	}
	return c.json(outcome.value, 200);
});
