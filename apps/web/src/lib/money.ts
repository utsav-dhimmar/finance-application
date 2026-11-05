// The display definition a formatter needs: the symbol and the number of
// fraction digits, both resolved by the supported-currency registry. The
// preferences response carries exactly these fields for the active display
// currency, so callers pass it straight through — adding a supported
// currency is a server-side data change, never a formatter change.
export interface CurrencyDisplayDefinition {
	symbol: string;
	minorUnitExponent: number;
}

// INR's display definition, hardwired only in the INR-defaulted wrappers
// below so the ~dozen existing call sites keep working unchanged while the
// preference plumbing rolls out.
const INR_DISPLAY: CurrencyDisplayDefinition = {
	symbol: "₹",
	minorUnitExponent: 2,
};

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
	const wholeStr = whole.toLocaleString("en-IN");
	const amount =
		currency.minorUnitExponent === 0
			? wholeStr
			: `${wholeStr}.${String(fraction).padStart(currency.minorUnitExponent, "0")}`;
	return negative
		? `-${currency.symbol}${amount}`
		: `${currency.symbol}${amount}`;
}

// Integer paise → INR display string, e.g. 125050 → "₹1,250.50".
// INR-defaulted wrapper over formatMinorUnits.
export function formatPaise(paise: number): string {
	return formatMinorUnits(paise, INR_DISPLAY);
}

// Integer minor units → plain major-unit decimal string for editing, e.g.
// 125050 with exponent 2 → "1250.50". Inverse of the shared amount input
// schemas' parsing; no symbol, sign preserved.
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

// Integer paise → plain rupee decimal string for editing, e.g. 125050 →
// "1250.50". INR-defaulted wrapper over minorToMajorInput.
export function paiseToRupeeInput(paise: number): string {
	return minorToMajorInput(paise, INR_DISPLAY);
}
