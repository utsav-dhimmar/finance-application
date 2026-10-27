import type { ApiErrorDetail } from "@finance-application/schemas";

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details: ApiErrorDetail[];

	constructor(
		status: number,
		code: string,
		message: string,
		details: ApiErrorDetail[],
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

interface ErrorEnvelope {
	error?: {
		code?: unknown;
		message?: unknown;
		details?: unknown;
	};
}

function parseErrorEnvelope(status: number, body: unknown): ApiError {
	const envelope = (
		typeof body === "object" && body !== null ? body : {}
	) as ErrorEnvelope;
	const error =
		typeof envelope.error === "object" && envelope.error !== null
			? envelope.error
			: {};
	const code = typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
	const message =
		typeof error.message === "string" ? error.message : "Request failed";
	const details = Array.isArray(error.details)
		? error.details.filter(
				(detail): detail is ApiErrorDetail =>
					typeof detail === "object" &&
					detail !== null &&
					typeof (detail as ApiErrorDetail).path === "string" &&
					typeof (detail as ApiErrorDetail).message === "string",
			)
		: [];
	return new ApiError(status, code, message, details);
}

async function readJson(res: Response): Promise<unknown> {
	try {
		return await res.json();
	} catch {
		return null;
	}
}

// Same-origin fetch with the shared error envelope decoding. Cookies are sent
// automatically (same-origin), carrying the auth session. `baseUrl` exists for
// non-browser clients that target a remote origin.
export async function apiFetch<T>(
	path: string,
	init?: RequestInit,
	options?: { baseUrl?: string },
): Promise<T> {
	const res = await fetch(`${options?.baseUrl ?? ""}${path}`, {
		...init,
		headers: { "content-type": "application/json", ...init?.headers },
	});
	const body = await readJson(res);
	if (!res.ok) {
		throw parseErrorEnvelope(res.status, body);
	}
	return body as T;
}
