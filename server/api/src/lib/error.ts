import type { Context, Env, ValidationTargets } from "hono";
import type { ZodError } from "zod";

export type ErrorCode =
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "INTERNAL_ERROR"
	| "EMAIL_TAKEN"
	| "AUTH_INVALID_CREDENTIALS"
	| "UNAUTHENTICATED"
	| "INVALID_REFRESH_TOKEN";

export interface ApiErrorDetail {
	readonly path: string;
	readonly message: string;
}

export interface ApiErrorBody {
	readonly error: {
		readonly code: ErrorCode;
		readonly message: string;
		readonly details: ApiErrorDetail[];
	};
}

export function errorBody(
	code: ErrorCode,
	message: string,
	details: ApiErrorDetail[] = [],
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
// Generic over the app env so it can serve as `defaultHook` on any OpenAPIHono.
export function validationHook<E extends Env>(
	result: { target: keyof ValidationTargets } & (
		| { success: true; data: unknown }
		| { success: false; error: ZodError }
	),
	context: Context<E, string>,
): Response | undefined {
	if (!result.success) {
		return context.json(validationErrorBody(result.error), 400);
	}
}
