import { describe, expect, it } from "vitest";
import worker from "@/index";

describe("worker entry", () => {
	it("exports a fetch handler that serves the app", async () => {
		expect(typeof worker.fetch).toBe("function");
		const res = await worker.fetch(new Request("http://localhost/api/hello"));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ message: "Hello, World!" });
	});
});
