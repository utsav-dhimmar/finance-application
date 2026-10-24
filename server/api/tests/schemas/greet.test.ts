import { describe, expect, it } from "vitest";
import { greetParamsSchema, greetQuerySchema } from "@/schemas/greet";

describe("greetQuerySchema", () => {
	it("applies defaults when no query parameters are given", () => {
		expect(greetQuerySchema.parse({})).toEqual({ greeting: "Hello", times: 1 });
	});

	it("coerces numeric query strings to integers", () => {
		expect(greetQuerySchema.parse({ greeting: "Namaste", times: "3" })).toEqual(
			{
				greeting: "Namaste",
				times: 3,
			},
		);
	});

	it("rejects a non-numeric times", () => {
		expect(greetQuerySchema.safeParse({ times: "abc" }).success).toBe(false);
	});

	it("rejects an out-of-range times", () => {
		expect(greetQuerySchema.safeParse({ times: "11" }).success).toBe(false);
		expect(greetQuerySchema.safeParse({ times: "0" }).success).toBe(false);
	});

	it("rejects a blank greeting", () => {
		expect(greetQuerySchema.safeParse({ greeting: " " }).success).toBe(false);
	});
});

describe("greetParamsSchema", () => {
	it("trims the name", () => {
		expect(greetParamsSchema.parse({ name: " Utsav " })).toEqual({
			name: "Utsav",
		});
	});

	it("rejects a blank name", () => {
		expect(greetParamsSchema.safeParse({ name: "  " }).success).toBe(false);
	});

	it("rejects a name longer than 100 characters", () => {
		expect(greetParamsSchema.safeParse({ name: "a".repeat(101) }).success).toBe(
			false,
		);
	});
});
