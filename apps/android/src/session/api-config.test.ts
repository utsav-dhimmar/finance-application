import { describe, expect, it } from "vitest";

import { MissingApiUrlError, resolveApiBaseUrl } from "./api-config";

describe("resolveApiBaseUrl", () => {
	it("returns the configured URL", () => {
		expect(resolveApiBaseUrl("http://192.168.1.10:8787")).toBe(
			"http://192.168.1.10:8787",
		);
	});

	it("strips trailing slashes", () => {
		expect(resolveApiBaseUrl("http://192.168.1.10:8787/")).toBe(
			"http://192.168.1.10:8787",
		);
		expect(resolveApiBaseUrl("http://192.168.1.10:8787//")).toBe(
			"http://192.168.1.10:8787",
		);
	});

	it("trims surrounding whitespace", () => {
		expect(resolveApiBaseUrl("  http://10.0.2.2:8787  ")).toBe(
			"http://10.0.2.2:8787",
		);
	});

	it("throws an actionable error when unset", () => {
		expect(() => resolveApiBaseUrl(undefined)).toThrow(MissingApiUrlError);
	});

	it("throws an actionable error when empty", () => {
		try {
			resolveApiBaseUrl("   ");
			expect.unreachable("resolveApiBaseUrl should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(MissingApiUrlError);
			if (error instanceof MissingApiUrlError) {
				expect(error.message).toContain("EXPO_PUBLIC_API_URL");
				expect(error.message).toContain("10.0.2.2");
			}
		}
	});
});
