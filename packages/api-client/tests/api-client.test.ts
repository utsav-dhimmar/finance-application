import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "../src/client";
import { login, logout, me, refresh, register } from "../src/auth";

const user = { id: "uuid-1", email: "user@example.com" };

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => jsonResponse(200, user)),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("apiFetch", () => {
	it("posts JSON and returns the decoded body", async () => {
		const result = await apiFetch<typeof user>("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ email: "user@example.com", password: "pw" }),
		});
		expect(result).toEqual(user);
		const fetchMock = vi.mocked(fetch);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/auth/login",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"content-type": "application/json",
				}),
			}),
		);
	});

	it("throws ApiError decoded from the error envelope", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(409, {
					error: {
						code: "EMAIL_TAKEN",
						message: "Email is already registered",
						details: [],
					},
				}),
			),
		);
		const error = await apiFetch("/api/auth/register", {
			method: "POST",
		}).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ApiError);
		if (error instanceof ApiError) {
			expect(error.status).toBe(409);
			expect(error.code).toBe("EMAIL_TAKEN");
			expect(error.message).toBe("Email is already registered");
		}
	});

	it("defaults unknown error bodies to INTERNAL_ERROR", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("not json", { status: 500 })),
		);
		const error = await apiFetch("/api/anything").catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ApiError);
		if (error instanceof ApiError) {
			expect(error.code).toBe("INTERNAL_ERROR");
		}
	});

	it("prefixes the optional baseUrl", async () => {
		await apiFetch("/api/auth/me", {}, { baseUrl: "https://api.example.com" });
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"https://api.example.com/api/auth/me",
			expect.anything(),
		);
	});
});

describe("auth endpoints", () => {
	it("register posts the credentials body and returns the user", async () => {
		await expect(
			register({ email: user.email, password: "long-enough" }),
		).resolves.toEqual(user);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/auth/register",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("login posts the credentials body and returns the user", async () => {
		await expect(
			login({ email: user.email, password: "long-enough" }),
		).resolves.toEqual(user);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/auth/login",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("me issues a GET without a body", async () => {
		await expect(me()).resolves.toEqual(user);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"/api/auth/me",
			expect.not.objectContaining({ method: expect.anything() }),
		);
	});

	it("refresh and logout issue POSTs", async () => {
		await expect(refresh()).resolves.toEqual(user);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 204 })),
		);
		await expect(logout()).resolves.toBeNull();
		expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
			method: "POST",
		});
	});
});
