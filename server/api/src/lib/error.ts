import type { Hook } from "@hono/zod-openapi";
import type { Env } from "hono";
import type { ZodError } from "zod";

export type ErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR";

export interface ApiErrorDetail {
	readonly path: string;
	readonly message: string;
}

export interface ApiErrorBody {
	readonly error: {
		readonly code: ErrorCode;
		readonly message: string;
		readonly details: readonly ApiErrorDetail[];
	};
}

function errorBody(
	code: ErrorCode,
	message: string,
	details: readonly ApiErrorDetail[],
): ApiErrorBody {
	return { error: { code, message, details } };
}

export function validationErrorBody(error: ZodError): ApiErrorBody {
	return errorBody(
		"VALIDATION_ERROR",
		"Request validation failed",
		error.issues.map((issue) => ({
			path: issue.path.join("."),
			message: issue.message,
		})),
	);
}

export function notFoundBody(): ApiErrorBody {
	return errorBody("NOT_FOUND", "Resource not found", []);
}

export function internalErrorBody(): ApiErrorBody {
	return errorBody("INTERNAL_ERROR", "Internal server error", []);
}

// Maps every @hono/zod-openapi validation failure to the shared error envelope.
export const validationHook: Hook<
	unknown,
	Env,
	string,
	Response | undefined
> = (result, context) => {
	if (!result.success) {
		return context.json(validationErrorBody(result.error), 400);
	}
};
