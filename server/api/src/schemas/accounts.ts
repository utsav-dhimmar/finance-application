import { z } from "@hono/zod-openapi";
import {
	accountListResponseSchema,
	accountNameSchema,
	accountResponseSchema,
	accountStatusSchema,
	accountStatuses,
	accountTypeSchema,
	amountMinorSchema,
} from "@finance-application/schemas";

// The shared package owns the validation rules; this module owns the OpenAPI
// metadata the route definitions need. The object schemas here are rebuilt
// from the shared field schemas so rule changes propagate from one place.
// Response and envelope schemas need no metadata and are re-exported as-is.

export {
	accountListResponseSchema,
	accountResponseSchema,
	accountStatusSchema,
};

export const createAccountBodySchema = z.object({
	name: accountNameSchema.openapi({ example: "HDFC Bank" }),
	type: accountTypeSchema.openapi({
		description: "cash, bank, or wallet",
	}),
	openingBalanceMinor: amountMinorSchema
		.openapi({
			description: "Opening balance in integer paise; defaults to 0",
		})
		.default(0),
});

export const updateAccountBodySchema = z.object({
	name: accountNameSchema.openapi({ example: "HDFC Bank" }).optional(),
	type: accountTypeSchema.optional(),
	openingBalanceMinor: amountMinorSchema.optional(),
});

export const restoreAccountBodySchema = z.object({
	newName: accountNameSchema.optional(),
});

export const listAccountsQuerySchema = z.object({
	status: z.enum(accountStatuses).default("active"),
});
