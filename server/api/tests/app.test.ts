import { describe, expect, it } from "vitest";
import { app } from "@/app";

describe("unknown routes", () => {
	it("return a structured 404 error body", async () => {
		const res = await app.request("/api/does-not-exist");
		expect(res.status).toBe(404);
		expect(res.headers.get("content-type")).toContain("application/json");
		await expect(res.json()).resolves.toEqual({
			error: { code: "NOT_FOUND", message: "Resource not found", details: [] },
		});
	});
});
