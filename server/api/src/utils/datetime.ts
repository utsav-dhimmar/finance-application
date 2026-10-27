// Generic date helpers. Stored timestamps are ISO-8601 text in UTC (see
// db/schema.ts); keep all server-side clock reads through these helpers so
// formatting stays consistent.

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isoNow(): string {
	return new Date().toISOString();
}

export function refreshExpiryIso(): string {
	return new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
}
