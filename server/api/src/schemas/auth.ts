import { z } from "@hono/zod-openapi";

// Emails are normalized to lowercase at the boundary so the unique index on
// users.email enforces case-insensitive uniqueness.
export const emailSchema = z.email().transform((value) => value.toLowerCase());

export const passwordSchema = z
	.string()
	.min(8)
	.max(128)
	.openapi({ description: "Plain password, 8-128 characters" });

export const registerBodySchema = z.object({
	email: emailSchema.openapi({ example: "user@example.com" }),
	password: passwordSchema,
});

export const loginBodySchema = z.object({
	email: emailSchema.openapi({ example: "user@example.com" }),
	password: passwordSchema,
});

export const userResponseSchema = z.object({
	id: z.string(),
	email: z.email(),
});

export const errorEnvelopeSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.array(z.object({ path: z.string(), message: z.string() })),
	}),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
