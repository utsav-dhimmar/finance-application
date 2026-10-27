import { z } from "@hono/zod-openapi";
import {
	emailSchema,
	errorEnvelopeSchema,
	passwordSchema,
	userResponseSchema,
} from "@finance-application/schemas";

// The shared package owns the validation rules; this module owns the OpenAPI
// metadata the route definitions need. The object schemas here are rebuilt
// from the shared field schemas so rule changes propagate from one place.
// Response and envelope schemas need no metadata and are re-exported as-is.

export {
	emailSchema,
	errorEnvelopeSchema,
	passwordSchema,
	userResponseSchema,
};

export const registerBodySchema = z.object({
	email: emailSchema.openapi({ example: "user@example.com" }),
	password: passwordSchema.openapi({
		description: "Plain password, 8-128 characters",
	}),
});

export const loginBodySchema = z.object({
	email: emailSchema.openapi({ example: "user@example.com" }),
	password: passwordSchema.openapi({
		description: "Plain password, 8-128 characters",
	}),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type { UserResponse } from "@finance-application/schemas";
