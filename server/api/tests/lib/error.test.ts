import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	internalErrorBody,
	notFoundBody,
	validationErrorBody,
} from "@/lib/error";

const timesSchema = z.object({ times: z.coerce.number().int().min(1).max(10) });

function parseFailure(input: unknown): z.ZodError {
	const result = timesSchema.safeParse(input);
	if (result.success) {
		throw new Error("expected the sample input to fail validation");
	}
	return result.error;
}

describe("validationErrorBody", () => {
	it("maps Zod issues to details naming the invalid parameter", () => {
		const body = validationErrorBody(parseFailure({ times: "abc" }));
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toBeTypeOf("string");
		expect(body.error.details).toContainEqual({
			path: "times",
			message: expect.any(String),
		});
	});
});

describe("notFoundBody", () => {
	it("uses the NOT_FOUND code with an empty details array", () => {
		expect(notFoundBody()).toEqual({
			error: { code: "NOT_FOUND", message: "Resource not found", details: [] },
		});
	});
});

describe("internalErrorBody", () => {
	it("uses the INTERNAL_ERROR code with an empty details array", () => {
		expect(internalErrorBody()).toEqual({
			error: {
				code: "INTERNAL_ERROR",
				message: "Internal server error",
				details: [],
			},
		});
	});
});
