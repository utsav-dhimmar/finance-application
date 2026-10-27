import { describe, expect, it } from "vitest";
import {
	errorEnvelopeSchema,
	loginBodySchema,
	passwordSchema,
	registerBodySchema,
	userResponseSchema,
} from "../src/auth";

describe("emailSchema", () => {
	it("normalizes emails to lowercase", () => {
		expect(registerBodySchema.parse({ email: "User@Example.COM", password: "long-enough" })).toEqual({
			email: "user@example.com",
			password: "long-enough",
		});
	});

	it("rejects non-emails", () => {
		expect(
			loginBodySchema.safeParse({ email: "not-an-email", password: "long-enough" })
				.success,
		).toBe(false);
	});
});

describe("passwordSchema", () => {
	it("rejects passwords shorter than 8 characters", () => {
		expect(passwordSchema.safeParse("short").success).toBe(false);
	});

	it("accepts passwords at the boundaries", () => {
		expect(passwordSchema.safeParse("12345678").success).toBe(true);
		expect(passwordSchema.safeParse("x".repeat(128)).success).toBe(true);
	});

	it("rejects passwords longer than 128 characters", () => {
		expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
	});
});

describe("userResponseSchema", () => {
	it("validates the authenticated user shape", () => {
		expect(
			userResponseSchema.parse({ id: "uuid", email: "user@example.com" }),
		).toEqual({ id: "uuid", email: "user@example.com" });
	});
});

describe("errorEnvelopeSchema", () => {
	it("validates the shared error envelope", () => {
		expect(
			errorEnvelopeSchema.parse({
				error: {
					code: "VALIDATION_ERROR",
					message: "Request validation failed",
					details: [{ path: "email", message: "Invalid email" }],
				},
			}),
		).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
	});
});
