import { describe, expect, it } from "vitest";
import {
	DUMMY_PASSWORD_HASH,
	DEFAULT_ITERATIONS,
	hashPassword,
	verifyPassword,
} from "@/lib/password";

// 30,000 is the spec'd ceiling (openspec/changes/switch-password-hashing-to-pbkdf2):
// the free Workers plan caps CPU at 10 ms per request and the default must
// keep one derivation inside it.
const MAX_DEFAULT_ITERATIONS = 30_000;

describe("hashPassword", () => {
	it("produces a PHC-formatted PBKDF2-SHA256 hash", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(hash).toMatch(/^\$pbkdf2-sha256\$\d+\$[^$]+\$[^$]+$/);
	});

	it("records the default iteration count, capped at the spec maximum", async () => {
		const hash = await hashPassword("correct horse battery staple");
		const iterations = Number(hash.split("$")[2]);
		expect(iterations).toBe(DEFAULT_ITERATIONS);
		expect(iterations).toBeLessThanOrEqual(MAX_DEFAULT_ITERATIONS);
	});

	it("records salt and derived key but never the plain password", async () => {
		const password = "correct horse battery staple";
		const hash = await hashPassword(password);
		expect(hash).not.toContain(password);
		const [, algorithm, , salt, key] = hash.split("$");
		expect(algorithm).toBe("pbkdf2-sha256");
		expect(atob(salt ?? "")).toHaveLength(16);
		expect(atob(key ?? "")).toHaveLength(32);
	});

	it("produces a different hash for the same password each time", async () => {
		const a = await hashPassword("correct horse battery staple");
		const b = await hashPassword("correct horse battery staple");
		expect(a).not.toBe(b);
	});

	it("honors an explicitly requested iteration count", async () => {
		const hash = await hashPassword("correct horse battery staple", 1000);
		expect(hash.split("$")[2]).toBe("1000");
	});
});

describe("verifyPassword", () => {
	it("accepts the correct password", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(await verifyPassword("correct horse battery staple", hash)).toBe(
			true,
		);
	});

	it("rejects a wrong password", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(await verifyPassword("wrong password", hash)).toBe(false);
	});

	it("honors the parameters recorded in the hash, not the current defaults", async () => {
		// A hand-built hash at a non-default iteration count must still verify,
		// so raising DEFAULT_ITERATIONS later never invalidates existing hashes.
		const hash = await hashPassword("correct horse battery staple", 1000);
		expect(await verifyPassword("correct horse battery staple", hash)).toBe(
			true,
		);
		expect(await verifyPassword("wrong password", hash)).toBe(false);
	});

	it("rejects a malformed hash", async () => {
		expect(
			await verifyPassword("correct horse battery staple", "not-a-phc-string"),
		).toBe(false);
	});

	it("rejects truncated and over-parameterized hashes", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(
			await verifyPassword(
				"correct horse battery staple",
				"$pbkdf2-sha256$25000",
			),
		).toBe(false);
		expect(
			await verifyPassword("correct horse battery staple", `${hash}$trailing`),
		).toBe(false);
		// An iteration count too large to spend CPU on is refused outright.
		expect(
			await verifyPassword(
				"correct horse battery staple",
				"$pbkdf2-sha256$99999999999$C/23hHlFPGl+Ccf5B9/YpQ==$kMljUuFOFjpc8VtXgMi9wYOSCbGCOEVXOOjFbDW5kZw=",
			),
		).toBe(false);
	});

	it("rejects foreign-algorithm hashes without deriving", async () => {
		// The legacy Argon2id format must parse as "unsupported", not crash.
		expect(
			await verifyPassword(
				"correct horse battery staple",
				"$argon2id$v=19$m=19456,t=2,p=1$z6oWm1enOFbPL8o8ly50dg==$VqYD/IKFoi7E1LsC0dYik6onpO/GFJBcBbQH5V5sCqY=",
			),
		).toBe(false);
	});
});

describe("DUMMY_PASSWORD_HASH", () => {
	it("is well-formed and uses the default iterations", () => {
		const [, algorithm, iterations, salt, key] = DUMMY_PASSWORD_HASH.split("$");
		expect(algorithm).toBe("pbkdf2-sha256");
		expect(Number(iterations)).toBe(DEFAULT_ITERATIONS);
		expect(atob(salt ?? "")).toHaveLength(16);
		expect(atob(key ?? "")).toHaveLength(32);
	});

	it("rejects every attempted password", async () => {
		// The dummy exists to equalize unknown-email work, never to authenticate.
		// Its throwaway source password was discarded at generation time, so no
		// known password verifies — and the service ignores the result besides.
		expect(
			await verifyPassword("correct horse battery staple", DUMMY_PASSWORD_HASH),
		).toBe(false);
		expect(await verifyPassword("", DUMMY_PASSWORD_HASH)).toBe(false);
		expect(
			await verifyPassword(
				"NTM5ZjM4NjQ2ZjZkNTM2ZjY0NjQ2ZjU2NjQ2ZjY0NjQ2Zg==",
				DUMMY_PASSWORD_HASH,
			),
		).toBe(false);
	});
});
