import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword", () => {
	it("produces a PHC-formatted Argon2id hash", () => {
		const hash = hashPassword("correct horse battery staple");
		expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
	});

	it("produces a different hash for the same password each time", () => {
		const a = hashPassword("correct horse battery staple");
		const b = hashPassword("correct horse battery staple");
		expect(a).not.toBe(b);
	});
});

describe("verifyPassword", () => {
	it("accepts the correct password", () => {
		const hash = hashPassword("correct horse battery staple");
		expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
	});

	it("rejects a wrong password", () => {
		const hash = hashPassword("correct horse battery staple");
		expect(verifyPassword("wrong password", hash)).toBe(false);
	});

	it("rejects a malformed hash", () => {
		expect(
			verifyPassword("correct horse battery staple", "not-a-phc-string"),
		).toBe(false);
	});
});
