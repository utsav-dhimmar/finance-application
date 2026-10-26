import { argon2id } from "@noble/hashes/argon2.js";

// Argon2id with OWASP's baseline parameters: m=19 MiB, t=2, p=1.
// Implemented with @noble/hashes (pure TypeScript): the Workers runtime
// disallows dynamic WebAssembly compilation, so hash-wasm cannot run there.
const ARGON2ID_MEMORY_KIB = 19456;
const ARGON2ID_ITERATIONS = 2;
const ARGON2ID_PARALLELISM = 1;
const ARGON2ID_HASH_LENGTH = 32;
const SALT_LENGTH = 16;

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

function derive(
	password: string,
	salt: Uint8Array,
	memoryKiB: number,
	iterations: number,
	parallelism: number,
): Uint8Array {
	return argon2id(password, salt, {
		m: memoryKiB,
		t: iterations,
		p: parallelism,
		dkLen: ARGON2ID_HASH_LENGTH,
	});
}

export function hashPassword(password: string): string {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const hash = derive(
		password,
		salt,
		ARGON2ID_MEMORY_KIB,
		ARGON2ID_ITERATIONS,
		ARGON2ID_PARALLELISM,
	);
	return `$argon2id$v=19$m=${ARGON2ID_MEMORY_KIB},t=${ARGON2ID_ITERATIONS},p=${ARGON2ID_PARALLELISM}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export function verifyPassword(password: string, hash: string): boolean {
	const parts = hash.split("$");
	// ["", "argon2id", "v=19", "m=..,t=..,p=..", salt, hash]
	if (parts.length !== 6 || parts[1] !== "argon2id") {
		return false;
	}
	const version = parts[2]?.replace(/^v=/, "");
	const params = parts[3]?.split(",").map((entry) => entry.split("="));
	const memoryKiB = Number(params?.find(([key]) => key === "m")?.[1]);
	const iterations = Number(params?.find(([key]) => key === "t")?.[1]);
	const parallelism = Number(params?.find(([key]) => key === "p")?.[1]);
	const saltB64 = parts[4];
	const expectedB64 = parts[5];
	if (
		version !== "19" ||
		!Number.isInteger(memoryKiB) ||
		!Number.isInteger(iterations) ||
		!Number.isInteger(parallelism) ||
		!saltB64 ||
		!expectedB64
	) {
		return false;
	}
	try {
		const derived = derive(
			password,
			base64ToBytes(saltB64),
			memoryKiB,
			iterations,
			parallelism,
		);
		return timingSafeEqual(derived, base64ToBytes(expectedB64));
	} catch {
		return false;
	}
}
