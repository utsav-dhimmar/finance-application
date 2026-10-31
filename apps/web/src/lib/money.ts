// Integer paise → INR display string, e.g. 125050 → "₹1,250.50".
// Pure integer arithmetic (trunc + modulo): no binary floating point touches
// the value; the integer minor unit stays the authoritative amount.
export function formatPaise(paise: number): string {
	const negative = paise < 0;
	const abs = Math.abs(paise);
	const whole = Math.trunc(abs / 100);
	const fraction = abs % 100;
	const wholeStr = whole.toLocaleString("en-IN");
	const amount = `${wholeStr}.${String(fraction).padStart(2, "0")}`;
	return negative ? `-₹${amount}` : `₹${amount}`;
}

// Integer paise → plain rupee decimal string for editing, e.g. 125050 →
// "1250.50". Inverse of the shared amountInputSchema's parsing.
export function paiseToRupeeInput(paise: number): string {
	const negative = paise < 0;
	const abs = Math.abs(paise);
	const whole = Math.trunc(abs / 100);
	const fraction = abs % 100;
	const amount = `${whole}.${String(fraction).padStart(2, "0")}`;
	return negative ? `-${amount}` : amount;
}
