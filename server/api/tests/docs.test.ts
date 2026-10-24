import { describe, expect, it } from "vitest";
import { app } from "@/app";

describe("GET /api/openapi", () => {
	it("serves an OpenAPI 3.1 document listing both endpoints", async () => {
		const res = await app.request("/api/openapi");
		expect(res.status).toBe(200);
		const doc: unknown = await res.json();
		expect(doc).toMatchObject({ openapi: "3.1.0" });
		expect(doc).toMatchObject({
			paths: {
				"/api/hello": expect.anything(),
				"/api/greet/{name}": expect.anything(),
			},
		});
	});
});

describe("GET /api/docs", () => {
	it("serves the interactive documentation viewer as HTML", async () => {
		const res = await app.request("/api/docs");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});
