import { z } from "zod";

// Single source of truth for auth validation rules, shared by the API and the
// web app. OpenAPI metadata for the API's route schemas is layered on top of
// these in server/api/src/schemas — do not add transport concerns here.

// Emails are normalized to lowercase at the boundary so the unique index on
// users.email enforces case-insensitive uniqueness.
export const emailSchema = z.email().transform((value) => value.toLowerCase());

export const passwordSchema = z
	.string()
	.min(8)
	.max(128)
	.describe("Plain password, 8-128 characters");

export const registerBodySchema = z.object({
	email: emailSchema,
	password: passwordSchema,
});

export const loginBodySchema = z.object({
	email: emailSchema,
	password: passwordSchema,
});

export const userResponseSchema = z.object({
	id: z.string(),
	email: z.email(),
});

export const apiErrorDetailSchema = z.object({
	path: z.string(),
	message: z.string(),
});

export const errorEnvelopeSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.array(apiErrorDetailSchema),
	}),
});

export type Email = z.infer<typeof emailSchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
