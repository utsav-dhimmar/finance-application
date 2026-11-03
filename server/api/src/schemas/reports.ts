import {
	reportMonthSchema,
	reportSummaryResponseSchema,
	reportYearSchema,
	transactionDateSchema,
} from "@finance-application/schemas";
import { z } from "@hono/zod-openapi";

// The shared package owns the validation rules; this module owns the OpenAPI
// metadata the route definition needs. The transport schema intentionally
// omits the shared period schema's cross-field refinement: the report service
// owns the exactly-one-form rule and answers with the INVALID_PERIOD error
// (400), the same split the transfer create body uses for its same-account
// rule. Response schemas need no metadata and are re-exported as-is.

export { reportSummaryResponseSchema };

export const reportPeriodQuerySchema = z.object({
	month: reportMonthSchema
		.openapi({
			description:
				"Calendar month (YYYY-MM); mutually exclusive with year and from/to",
			example: "2026-01",
		})
		.optional(),
	year: reportYearSchema
		.openapi({
			description:
				"Calendar year (YYYY); mutually exclusive with month and from/to",
			example: "2026",
		})
		.optional(),
	from: transactionDateSchema
		.openapi({
			description: "Inclusive range start (YYYY-MM-DD); requires to",
		})
		.optional(),
	to: transactionDateSchema
		.openapi({
			description: "Inclusive range end (YYYY-MM-DD); requires from",
		})
		.optional(),
});
