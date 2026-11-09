// Set-Cookie parsing for the mobile session layer. React Native on Android
// may merge multiple Set-Cookie headers into one comma-joined string, so the
// parser must split on commas that start a new cookie while keeping the
// commas inside Expires dates (e.g. "Expires=Wed, 21 Oct 2025 07:28:00 GMT").

export interface ParsedCookie {
	name: string;
	value: string;
}

/**
 * Splits a comma-joined Set-Cookie header value into individual cookie
 * strings. A comma starts a new cookie only when what follows looks like
 * `name=`; commas inside date values never satisfy that shape.
 */
function splitCookieStrings(joined: string): string[] {
	const parts: string[] = [];
	let current = "";
	for (let index = 0; index < joined.length; index++) {
		const ch = joined.charAt(index);
		if (ch === ",") {
			const rest = joined.slice(index + 1);
			if (/^\s*[^\s=;,]+\s*=/.test(rest)) {
				parts.push(current);
				current = "";
				continue;
			}
		}
		current += ch;
	}
	parts.push(current);
	return parts;
}

/** Parses one cookie string, keeping only the name and value (attributes are stripped). */
function parseCookiePair(segment: string): ParsedCookie | null {
	const trimmed = segment.trim();
	const equals = trimmed.indexOf("=");
	if (equals <= 0) {
		return null;
	}
	const name = trimmed.slice(0, equals).trim();
	const rest = trimmed.slice(equals + 1);
	const semicolon = rest.indexOf(";");
	const value = (
		semicolon === -1 ? rest : rest.slice(0, semicolon)
	).trim();
	if (name.length === 0) {
		return null;
	}
	return { name, value };
}

/**
 * Parses Set-Cookie header content into name/value pairs, handling both the
 * array form (one header per entry, as returned by `Headers.getSetCookie()`)
 * and the comma-joined form (as returned by `Headers.get("set-cookie")` on
 * Android). Unknown or malformed segments are skipped.
 */
export function parseSetCookie(input: string | string[]): ParsedCookie[] {
	const entries = Array.isArray(input) ? input : [input];
	const cookies: ParsedCookie[] = [];
	for (const entry of entries) {
		if (entry.length === 0) {
			continue;
		}
		for (const segment of splitCookieStrings(entry)) {
			const cookie = parseCookiePair(segment);
			if (cookie !== null) {
				cookies.push(cookie);
			}
		}
	}
	return cookies;
}
