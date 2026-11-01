import { describe, expect, it } from "vitest";
import {
	CATEGORY_NAME_MAX_LENGTH,
	categoryColorSchema,
	categoryFormSchema,
	categoryIconSchema,
	categoryNameSchema,
	categoryTypeSchema,
	createCategoryBodySchema,
	updateCategoryBodySchema,
} from "../src/categories";

describe("categoryNameSchema", () => {
	it("trims surrounding whitespace", () => {
		expect(categoryNameSchema.parse("  Food  ")).toBe("Food");
	});

	it.each(["", "   "])("rejects a blank name (%s)", (input) => {
		expect(() => categoryNameSchema.parse(input)).toThrow();
	});

	it("rejects names beyond the length limit", () => {
		expect(() => categoryNameSchema.parse("a".repeat(81))).toThrow();
		expect(categoryNameSchema.parse("a".repeat(CATEGORY_NAME_MAX_LENGTH))).toBe(
			"a".repeat(CATEGORY_NAME_MAX_LENGTH),
		);
	});
});

describe("categoryTypeSchema", () => {
	it("accepts the two supported types", () => {
		expect(categoryTypeSchema.parse("income")).toBe("income");
		expect(categoryTypeSchema.parse("expense")).toBe("expense");
	});

	it("rejects other types", () => {
		expect(() => categoryTypeSchema.parse("transfer")).toThrow();
	});
});

describe("categoryColorSchema", () => {
	it("accepts six-digit hex colors", () => {
		expect(categoryColorSchema.parse("#22C55E")).toBe("#22C55E");
		expect(categoryColorSchema.parse("#22c55e")).toBe("#22c55e");
	});

	it.each(["22C55E", "#22C5", "#22C55EG", "rgb(0,0,0)", ""])(
		"rejects %s",
		(input) => {
			expect(() => categoryColorSchema.parse(input)).toThrow();
		},
	);
});

describe("categoryIconSchema", () => {
	it("accepts kebab-case lucide icon names", () => {
		expect(categoryIconSchema.parse("utensils")).toBe("utensils");
		expect(categoryIconSchema.parse("shopping-cart")).toBe("shopping-cart");
	});

	it("accepts an empty string as unset", () => {
		expect(categoryIconSchema.parse("")).toBe("");
	});

	it.each(["Utensils", "shopping cart", "utensils!", "a".repeat(51)])(
		"rejects %s",
		(input) => {
			expect(() => categoryIconSchema.parse(input)).toThrow();
		},
	);
});

describe("createCategoryBodySchema", () => {
	it("accepts a minimal body without presentation values", () => {
		expect(createCategoryBodySchema.parse({ name: "Food", type: "expense" })).toEqual({
			name: "Food",
			type: "expense",
		});
	});

	it("accepts presentation values", () => {
		expect(
			createCategoryBodySchema.parse({
				name: "Food",
				type: "expense",
				color: "#22C55E",
				icon: "utensils",
			}),
		).toEqual({
			name: "Food",
			type: "expense",
			color: "#22C55E",
			icon: "utensils",
		});
	});

	it.each([
		["blank name", { name: "   ", type: "expense" }],
		["unknown type", { name: "Food", type: "transfer" }],
		["bad hex color", { name: "Food", type: "expense", color: "green" }],
		["bad icon name", { name: "Food", type: "expense", icon: "Big Icon" }],
	])("rejects %s", (_label, body) => {
		expect(() => createCategoryBodySchema.parse(body)).toThrow();
	});
});

describe("updateCategoryBodySchema", () => {
	it("accepts a partial patch", () => {
		expect(updateCategoryBodySchema.parse({ name: "Groceries" })).toEqual({
			name: "Groceries",
		});
	});

	it("accepts null to clear presentation values", () => {
		expect(updateCategoryBodySchema.parse({ color: null, icon: null })).toEqual({
			color: null,
			icon: null,
		});
	});

	it("rejects an invalid type change", () => {
		expect(() => updateCategoryBodySchema.parse({ type: "both" })).toThrow();
	});
});

describe("categoryFormSchema", () => {
	it("accepts empty presentation strings as unset", () => {
		const values = categoryFormSchema.parse({
			name: "Food",
			type: "expense",
			color: "",
			icon: "",
		});
		expect(values).toEqual({
			name: "Food",
			type: "expense",
			color: "",
			icon: "",
		});
	});

	it("keeps and validates non-empty presentation values", () => {
		const values = categoryFormSchema.parse({
			name: "Food",
			type: "expense",
			color: "#22C55E",
			icon: "utensils",
		});
		expect(values).toEqual({
			name: "Food",
			type: "expense",
			color: "#22C55E",
			icon: "utensils",
		});
		expect(() =>
			categoryFormSchema.parse({ name: "Food", type: "expense", color: "green" }),
		).toThrow();
	});
});
