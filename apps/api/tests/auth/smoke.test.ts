/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("workers pool environment", () => {
	it("exposes the D1 binding with auth tables migrated", async () => {
		const result = await env.finance_application
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'refresh_tokens') ORDER BY name",
			)
			.all<{ name: string }>();
		expect(result.success).toBe(true);
		expect(result.results.map((row) => row.name)).toEqual([
			"refresh_tokens",
			"users",
		]);
	});

	it("exposes the JWT secret binding", () => {
		expect(env.JWT_SECRET).toBe("test-secret-for-workers-pool");
	});
});
