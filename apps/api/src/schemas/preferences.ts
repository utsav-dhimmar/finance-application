import { currencyCodeSchema } from "@finance-application/schemas";
import { preferencesResponseSchema } from "@finance-application/schemas";
import { z } from "@hono/zod-openapi";

// The shared package owns the validation rules; this module owns the OpenAPI
// metadata the route definitions need. The response schema needs no metadata
// and is re-exported as-is.

export { preferencesResponseSchema };

export const updatePreferencesBodySchema = z.strictObject({
	currencyCode: currencyCodeSchema.openapi({
		description: "ISO 4217 code of a supported display currency",
		example: "INR",
	}),
});
