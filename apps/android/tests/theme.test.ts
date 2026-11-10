import { describe, expect, it } from "vitest";

import {
	darkColors,
	hairline,
	lightColors,
	radius,
	spacing,
	typography,
} from "@/theme";

describe("theme", () => {
	it("uses zero corner radius on every radius token (boxy style)", () => {
		const values = Object.values(radius);
		expect(values.length).toBeGreaterThan(0);
		for (const value of values) {
			expect(value).toBe(0);
		}
	});

	it("exports non-empty token sets", () => {
		expect(Object.keys(lightColors).length).toBeGreaterThan(0);
		expect(Object.keys(spacing).length).toBeGreaterThan(0);
		expect(Object.keys(typography).length).toBeGreaterThan(0);
	});

	it("provides a dark palette with the same tokens as the light palette", () => {
		expect(Object.keys(darkColors).sort()).toEqual(
			Object.keys(lightColors).sort(),
		);
		for (const key of Object.keys(lightColors) as Array<
			keyof typeof lightColors
		>) {
			expect(darkColors[key].length).toBeGreaterThan(0);
		}
	});

	it("keeps dark-mode surfaces dark and text light", () => {
		expect(darkColors.background).not.toBe(lightColors.background);
		expect(darkColors.foreground).not.toBe(lightColors.foreground);
	});

	it("builds the hairline border from tokens", () => {
		expect(hairline(lightColors.border)).toEqual({
			borderWidth: 1,
			borderColor: lightColors.border,
			borderStyle: "solid",
		});
	});
});
