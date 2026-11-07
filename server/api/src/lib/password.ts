// PBKDF2-HMAC-SHA256 through WebCrypto: natively implemented in workerd,
// Node, and miniflare, so a login's password verification fits the Workers
// free plan's hard 10 ms CPU budget. The previous pure-TypeScript Argon2id
// implementation cost 0.5–1.5 s of CPU per derivation and every production
// login failed with "Worker exceeded CPU time limit".
//
// Measured derivation cost (native WebCrypto, local machine, best of 3):
// 10k ≈ 2.8 ms · 25k ≈ 5.9 ms · 50k ≈ 11.1 ms · 100k ≈ 21 ms · 600k ≈ 130 ms.
// Under real workerd (miniflare, task 4.1) PBKDF2 runs ~2.5× slower than
// local Node: 10k ≈ 6 ms, 25k ≈ 13–15 ms — so 25,000 blows the 10 ms budget
// on the real runtime and the default is 10,000, which fits with headroom
// for routing, validation, and database work. Raise it (via re-hash) only
// after moving to Workers Paid.
export const DEFAULT_ITERATIONS = 10_000;
const SALT_LENGTH = 16;
const KEY_LENGTH_BITS = 256;
const ALGORITHM_TAG = "pbkdf2-sha256";
// A stored hash must claim a sane iteration count before any CPU is spent on
// it: a corrupt or hostile row can never make verification unbounded.
export const MAX_VERIFIED_ITERATIONS = 10_000_000;

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let difference = 0;
	for (let i = 0; i < a.length; i++) {
		difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return difference === 0;
}

async function derive(
	password: string,
	salt: Uint8Array,
	iterations: number,
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", salt, iterations },
		key,
		KEY_LENGTH_BITS,
	);
	return new Uint8Array(bits);
}

export async function hashPassword(
	password: string,
	iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const hash = await derive(password, salt, iterations);
	// PHC-style modular-crypt format: every parameter a verification needs is
	// embedded in the string itself, so defaults can change without
	// invalidating existing hashes.
	return `$${ALGORITHM_TAG}$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

// Fixed hash of a throwaway password at the default iterations. Verifying
// login attempts for unknown emails against it costs the same as a real
// verification, so response work does not reveal whether an email is
// registered. The throwaway password was generated at random and discarded at
// generation time — it exists nowhere, so no password can authenticate against
// this hash, and the service ignores the comparison result besides. If the
// account is ever re-hashed at different iterations, regenerate this constant
// to match (scripts/hash-password.mts prints one).
export const DUMMY_PASSWORD_HASH =
	"$pbkdf2-sha256$10000$ISa6d7eti8XZJJFJVA2fqw==$BEx1I4eSpX+gY5GCqpnuK3WWuB2nIZF9jNFy3LkYn34=";

export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	const parts = hash.split("$");
	// ["", "pbkdf2-sha256", "<iterations>", "<salt b64>", "<hash b64>"]
	if (parts.length !== 5 || parts[1] !== ALGORITHM_TAG) {
		return false;
	}
	const iterations = Number(parts[2]);
	const saltB64 = parts[3];
	const expectedB64 = parts[4];
	if (
		!Number.isInteger(iterations) ||
		iterations < 1 ||
		iterations > MAX_VERIFIED_ITERATIONS ||
		!saltB64 ||
		!expectedB64
	) {
		return false;
	}
	let salt: Uint8Array;
	let expected: Uint8Array;
	try {
		salt = base64ToBytes(saltB64);
		expected = base64ToBytes(expectedB64);
	} catch {
		return false;
	}
	try {
		const derived = await derive(password, salt, iterations);
		return timingSafeEqual(derived, expected);
	} catch {
		return false;
	}
}
