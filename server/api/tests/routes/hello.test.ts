import { describe, expect, it } from "vitest";
import { helloRoutes } from "@/routes/hello";

describe("GET /api/hello", () => {
	it("returns the fixed hello message as JSON", async () => {
		const res = await helloRoutes.request("/api/hello");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		await expect(res.json()).resolves.toEqual({ message: "Hello, World!" });
	});
});
