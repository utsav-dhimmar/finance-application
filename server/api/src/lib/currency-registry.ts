import type { CurrencyCode } from "@finance-application/schemas";
import { supportedCurrencyCodes } from "@finance-application/schemas";

// The single currency truth on the server: each supported display currency's
// ISO 4217 code with its display symbol and minor-unit exponent. The codes
// come from the shared schemas package (one list everywhere); only their
// metadata lives here, so adding a currency is a data change — the API
// validation, response resolution, and client formatters all derive from this
// registry and the shared union.

export interface CurrencyDefinition {
	readonly code: CurrencyCode;
	readonly symbol: string;
	readonly minorUnitExponent: number;
}

export const CURRENCY_REGISTRY: Readonly<
	Record<(typeof supportedCurrencyCodes)[number], CurrencyDefinition>
> = {
	INR: { code: "INR", symbol: "₹", minorUnitExponent: 2 },
};

export const DEFAULT_CURRENCY_CODE: CurrencyCode = "INR";

// Compile-time completeness guard: widening the shared union without adding a
// registry entry fails typecheck here, so the registry can never lag the
// schema contract.
const _registryCoversEverySupportedCode: Record<
	(typeof supportedCurrencyCodes)[number],
	CurrencyDefinition
> = CURRENCY_REGISTRY;
void _registryCoversEverySupportedCode;

// Narrows arbitrary input (a client body field, a database column) to a
// supported code; the caller decides how to reject the rest.
export function isSupportedCurrencyCode(code: string): code is CurrencyCode {
	return (supportedCurrencyCodes as readonly string[]).includes(code);
}

export function currencyDefinition(code: CurrencyCode): CurrencyDefinition {
	return CURRENCY_REGISTRY[code];
}
