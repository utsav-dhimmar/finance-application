// The single name-normalization point shared by every entity with
// case-insensitive, whitespace-trimmed name uniqueness (accounts, categories):
// the value written to each table's `name_normalized` mirror column, backed by
// a partial unique index.
export function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}
