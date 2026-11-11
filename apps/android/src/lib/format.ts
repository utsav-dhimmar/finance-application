import type { TextStyle } from "react-native";

import type { PreferencesResponse } from "@finance-application/schemas";

// The display definition a formatter needs: the symbol and the number of
// fraction digits. The preferences response carries exactly these fields for
// the active display currency, so callers pass it straight through — adding
// a supported currency is a server-side data change, never a formatter
// change. INR is hardwired only as the fallback for screens that render
// before the preferences query resolves (the only initially supported
// currency), mirroring the web's INR-defaulted wrappers.
export interface CurrencyDisplayDefinition {
	symbol: string;
	minorUnitExponent: number;
}

export const INR_DISPLAY: CurrencyDisplayDefinition = {
	symbol: "₹",
	minorUnitExponent: 2,
};

/** Maps the API's preferences response onto a display definition. */
export function preferencesToDisplay(
	preferences: PreferencesResponse,
): CurrencyDisplayDefinition {
	return {
		symbol: preferences.currencySymbol,
		minorUnitExponent: preferences.minorUnitExponent,
	};
}

// Digit grouping for en-IN: the last group holds 3 digits and every group
// before it holds 2, e.g. 125050 → "1,25,050". Implemented by hand instead of
// Number.toLocaleString("en-IN") so the output is identical across JS
// engines (the web helper relies on the browser's Intl for the same shape).
function groupEnIn(digits: string): string {
	if (digits.length <= 3) {
		return digits;
	}
	const last = digits.slice(-3);
	let rest = digits.slice(0, -3);
	const groups: string[] = [];
	while (rest.length > 2) {
		groups.unshift(rest.slice(-2));
		rest = rest.slice(0, -2);
	}
	if (rest.length > 0) {
		groups.unshift(rest);
	}
	return [...groups, last].join(",");
}

// Integer minor units → display string for the given currency, e.g.
// 125050 with exponent 2 → "₹1,250.50". The fraction-digit count derives
// from the minor-unit exponent. Pure integer arithmetic (trunc + modulo):
// no binary floating point touches the value; the integer minor unit stays
// the authoritative amount.
export function formatMinorUnits(
	minor: number,
	currency: CurrencyDisplayDefinition,
): string {
	const scale = 10 ** currency.minorUnitExponent;
	const negative = minor < 0;
	const abs = Math.abs(minor);
	const whole = Math.trunc(abs / scale);
	const fraction = abs % scale;
	const wholeStr = groupEnIn(String(whole));
	const amount =
		currency.minorUnitExponent === 0
			? wholeStr
			: `${wholeStr}.${String(fraction).padStart(currency.minorUnitExponent, "0")}`;
	return negative
		? `-${currency.symbol}${amount}`
		: `${currency.symbol}${amount}`;
}

// Integer minor units → plain major-unit decimal string for editing, e.g.
// 125050 with exponent 2 → "1250.50". Inverse of the shared amount input
// schemas' parsing; no symbol, sign preserved, no grouping.
export function minorToMajorInput(
	minor: number,
	currency: CurrencyDisplayDefinition,
): string {
	const scale = 10 ** currency.minorUnitExponent;
	const negative = minor < 0;
	const abs = Math.abs(minor);
	const whole = Math.trunc(abs / scale);
	const fraction = abs % scale;
	const amount =
		currency.minorUnitExponent === 0
			? String(whole)
			: `${whole}.${String(fraction).padStart(currency.minorUnitExponent, "0")}`;
	return negative ? `-${amount}` : amount;
}

// Financial amounts set in monospaced-style tabular numerals so columns of
// figures stay aligned, per the web's font-mono tabular-nums typography.
export const tabularNums: Pick<TextStyle, "fontVariant"> = {
	fontVariant: ["tabular-nums"],
};
