import { describe, expect, it } from "vitest";
import { greetRoutes } from "@/routes/greet";

describe("GET /api/greet/{name}", () => {
	it("applies query parameter defaults", async () => {
		const res = await greetRoutes.request("/api/greet/Utsav");
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ messages: ["Hello, Utsav!"] });
	});

	it("uses the supplied greeting and repetition count", async () => {
		const res = await greetRoutes.request(
			"/api/greet/Utsav?greeting=Namaste&times=3",
		);
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({
			messages: ["Namaste, Utsav!", "Namaste, Utsav!", "Namaste, Utsav!"],
		});
	});

	it("trims surrounding whitespace from the name", async () => {
		const res = await greetRoutes.request("/api/greet/%20Utsav%20");
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ messages: ["Hello, Utsav!"] });
	});

	it("returns 400 when times is not a whole number", async () => {
		const res = await greetRoutes.request("/api/greet/Utsav?times=abc");
		expect(res.status).toBe(400);
		const body: unknown = await res.json();
		expect(body).toEqual({
			error: {
				code: "VALIDATION_ERROR",
				message: expect.any(String),
				details: expect.arrayContaining([
					{ path: "times", message: expect.any(String) },
				]),
			},
		});
	});

	it("returns 400 when times is out of range", async () => {
		const res = await greetRoutes.request("/api/greet/Utsav?times=11");
		expect(res.status).toBe(400);
	});

	it("returns 400 when the greeting is blank", async () => {
		const res = await greetRoutes.request("/api/greet/Utsav?greeting=%20");
		expect(res.status).toBe(400);
	});

	it("returns 400 when the name is blank", async () => {
		const res = await greetRoutes.request("/api/greet/%20%20");
		expect(res.status).toBe(400);
	});
});
