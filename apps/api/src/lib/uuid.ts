// RFC 9562 UUIDv7: 48-bit millisecond timestamp + random, for stable
// time-sortable identifiers (AGENTS.md convention).

export function uuidV7(): string {
	const timestamp = BigInt(Date.now());
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[0] = Number((timestamp >> 40n) & 0xffn);
	bytes[1] = Number((timestamp >> 32n) & 0xffn);
	bytes[2] = Number((timestamp >> 24n) & 0xffn);
	bytes[3] = Number((timestamp >> 16n) & 0xffn);
	bytes[4] = Number((timestamp >> 8n) & 0xffn);
	bytes[5] = Number(timestamp & 0xffn);
	const versionByte = bytes[6] ?? 0;
	const variantByte = bytes[8] ?? 0;
	bytes[6] = (versionByte & 0x0f) | 0x70; // version 7
	bytes[8] = (variantByte & 0x3f) | 0x80; // RFC variant 10
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
