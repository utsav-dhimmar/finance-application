// LIKE search matches user text literally: `%` and `_` are SQLite wildcards,
// so search input escapes them (and the escape character itself) before being
// wrapped into a `%needle%` pattern. Every LIKE built from user input pairs
// this helper with an `ESCAPE` clause bound from LIKE_ESCAPE.
export const LIKE_ESCAPE = "\\";

export function escapeLike(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll("%", "\\%")
		.replaceAll("_", "\\_");
}
