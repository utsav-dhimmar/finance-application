import type { CategoryResponse } from "@finance-application/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	archiveCategory,
	createCategory,
	deleteCategory,
	getCategory,
	listCategories,
	permanentlyDeleteCategory,
	restoreCategory,
	updateCategory,
} from "../src/categories";
import { ApiError } from "../src/client";

const category: CategoryResponse = {
	id: "uuid-1",
	name: "Groceries",
	type: "expense",
	color: "#22C55E",
	icon: "shopping-cart",
	status: "active",
	archivedAt: null,
	deletedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(category), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("category client functions", () => {
	it("createCategory posts the body to /api/categories", async () => {
		const body = {
			name: "Groceries",
			type: "expense" as const,
			color: "#22C55E",
			icon: "shopping-cart",
		};
		await expect(createCategory(body)).resolves.toEqual(category);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/categories",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(body),
			}),
		);
	});

	it("listCategories defaults to the active status", async () => {
		await listCategories();
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/categories?status=active");
	});

	it("listCategories passes the requested status", async () => {
		await listCategories("archived");
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/categories?status=archived");
	});

	it("getCategory fetches by id", async () => {
		await getCategory("uuid-1");
		const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/categories/uuid-1");
	});

	it("updateCategory patches by id, including null presentation values", async () => {
		const body = { name: "Renamed", color: null, icon: null };
		await updateCategory("uuid-1", body);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/categories/uuid-1",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		);
	});

	it.each([
		["archive", archiveCategory, "/api/categories/uuid-1/archive"],
		["delete", deleteCategory, "/api/categories/uuid-1/delete"],
		["restore", restoreCategory, "/api/categories/uuid-1/restore"],
	])("%s posts to its lifecycle endpoint", async (_label, action, url) => {
		await action("uuid-1");
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			url,
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("restoreCategory sends an optional new name", async () => {
		await restoreCategory("uuid-1", { newName: "Restored" });
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/categories/uuid-1/restore",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ newName: "Restored" }),
			}),
		);
	});

	it("permanentlyDeleteCategory sends DELETE and resolves empty on 204", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 204 })),
		);
		await expect(permanentlyDeleteCategory("uuid-1")).resolves.toBeUndefined();
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/categories/uuid-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("surfaces PERMANENT_DELETE_BLOCKED as an ApiError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "PERMANENT_DELETE_BLOCKED",
								message:
									"This category still has transactions referencing it",
								details: [],
							},
						}),
						{ status: 409, headers: { "content-type": "application/json" } },
					),
			),
		);
		const error = await permanentlyDeleteCategory("uuid-1").catch(
			(e: unknown) => e,
		);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(409);
		expect((error as ApiError).code).toBe("PERMANENT_DELETE_BLOCKED");
	});

	it("decodes the shared error envelope into an ApiError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "CATEGORY_NAME_TAKEN",
								message: "A category with this name already exists",
								details: [],
							},
						}),
						{ status: 409, headers: { "content-type": "application/json" } },
					),
			),
		);
		const error = await createCategory({
			name: "Groceries",
			type: "expense",
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(409);
		expect((error as ApiError).code).toBe("CATEGORY_NAME_TAKEN");
	});
});
