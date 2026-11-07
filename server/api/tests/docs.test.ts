import { describe, expect, it } from "vitest";
import { app } from "@/app";

// Documentation is configuration-gated: enabled with DOCS_ENABLED=true
// (local development), disabled by default (production).
const DOCS_ENV = { DOCS_ENABLED: "true" };

describe("GET /api/openapi (enabled)", () => {
	it("serves an OpenAPI 3.1 document listing the endpoints", async () => {
		const res = await app.request("/api/openapi", undefined, DOCS_ENV);
		expect(res.status).toBe(200);
		const doc: unknown = await res.json();
		expect(doc).toMatchObject({ openapi: "3.1.0" });
		expect(doc).toMatchObject({
			paths: {
				"/api/hello": expect.anything(),
				"/api/greet/{name}": expect.anything(),
				"/api/transfers": expect.anything(),
				"/api/transfers/:id": expect.anything(),
				"/api/transfers/:id/archive": expect.anything(),
				"/api/transfers/:id/delete": expect.anything(),
				"/api/transfers/:id/restore": expect.anything(),
				"/api/activity": expect.anything(),
				"/api/reports/summary": expect.anything(),
				"/api/preferences": expect.anything(),
			},
		});
	});

	it("registers the permanent-delete operations for accounts and categories", async () => {
		const res = await app.request("/api/openapi", undefined, DOCS_ENV);
		expect(res.status).toBe(200);
		const doc = (await res.json()) as {
			paths: Record<string, Record<string, unknown>>;
		};
		expect(doc.paths["/api/accounts/:id"]?.delete).toBeDefined();
		expect(doc.paths["/api/categories/:id"]?.delete).toBeDefined();
	});
});

describe("GET /api/docs (enabled)", () => {
	it("serves the interactive documentation viewer as HTML", async () => {
		const res = await app.request("/api/docs", undefined, DOCS_ENV);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});
});

describe("documentation disabled (default)", () => {
	it.each(["/api/openapi", "/api/docs"])(
		"answers the standard 404 envelope for %s",
		async (path) => {
			const res = await app.request(path);
			expect(res.status).toBe(404);
			expect(res.headers.get("content-type")).toContain("application/json");
			await expect(res.json()).resolves.toEqual({
				error: {
					code: "NOT_FOUND",
					message: "Resource not found",
					details: [],
				},
			});
		},
	);

	it("answers 404 for both paths even when explicitly disabled", async () => {
		const res = await app.request("/api/openapi", undefined, {
			DOCS_ENABLED: "false",
		});
		expect(res.status).toBe(404);
	});
});
