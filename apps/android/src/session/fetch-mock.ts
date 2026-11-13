import { vi } from "vitest";

export type FetchHandler = (
	init: RequestInit | undefined,
) => Response | Promise<Response>;

export const user = { id: "user-1", email: "user@example.com" };

export const API_BASE = "https://api.test";

export function jsonResponse(
	status: number,
	body: unknown,
	headers?: HeadersInit,
): Response {
	return new Response(status === 204 ? null : JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...headers },
	});
}

export function errorEnvelope(
	status: number,
	code: string,
	message: string,
): Response {
	return jsonResponse(status, { error: { code, message, details: [] } });
}

/** Creates a mocked global fetch routing on method+path; unexpected requests throw. */
export function stubFetchRouter(
	handlers: Record<string, FetchHandler>,
): ReturnType<typeof vi.fn> {
	return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const method = (init?.method ?? "GET").toUpperCase();
		const path =
			typeof input === "string"
				? new URL(input).pathname
				: input instanceof URL
					? input.pathname
					: new URL(input.url).pathname;
		const handler = handlers[`${method} ${path}`];
		if (handler === undefined) {
			throw new Error(`Unexpected request: ${method} ${path}`);
		}
		return handler(init);
	});
}
