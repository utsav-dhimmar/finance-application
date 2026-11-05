import { z } from "zod";

// Single source of truth for the application-preferences contracts, shared by
// the API, the web app, and the future mobile client. OpenAPI metadata for the
// API's route schemas is layered on top of these in server/api/src/schemas —
// do not add transport concerns here.

// Supported display currencies. Only INR is initially enabled: showing amounts
// in a currency that would require exchange-rate conversion while conversion
// is unimplemented would misrepresent stored money, so this union gates the
// server-side registry. Adding a currency is a data change in the registry
// plus a widening of this union — never a formatter change.
export const supportedCurrencyCodes = ["INR"] as const;
export const currencyCodeSchema = z.enum(supportedCurrencyCodes);
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

// The API resolves the registry metadata (symbol and minor-unit exponent) for
// the active currency so clients never hardcode it; amounts themselves stay
// raw integer minor units and are formatted client-side.
export const preferencesResponseSchema = z.object({
	currencyCode: currencyCodeSchema,
	currencySymbol: z.string().min(1),
	minorUnitExponent: z.number().int().min(0),
});

// Strict on purpose: unknown fields are a client bug and must be rejected by
// the API rather than silently ignored.
export const updatePreferencesBodySchema = z.strictObject({
	currencyCode: currencyCodeSchema,
});

export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBodySchema>;
