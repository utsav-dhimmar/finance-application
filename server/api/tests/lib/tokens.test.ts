import { describe, expect, it } from "vitest";
import {
	generateRefreshToken,
	hashToken,
	signAccessToken,
	verifyAccessToken,
} from "@/lib/tokens";

const SECRET = "test-secret-for-unit-tests";

describe("access tokens", () => {
	it("roundtrips the user id through sign and verify", async () => {
		const token = await signAccessToken("user-1", SECRET);
		const payload = await verifyAccessToken(token, SECRET);
		expect(payload?.sub).toBe("user-1");
		expect(payload?.exp).toBeGreaterThan(payload?.iat ?? 0);
	});

	it("rejects a token signed with a different secret", async () => {
		const token = await signAccessToken("user-1", SECRET);
		await expect(verifyAccessToken(token, "other-secret")).resolves.toBeNull();
	});

	it("rejects a malformed token", async () => {
		await expect(verifyAccessToken("not-a-jwt", SECRET)).resolves.toBeNull();
	});
});

describe("refresh tokens", () => {
	it("generates 43-character base64url tokens with high entropy", async () => {
		const a = generateRefreshToken();
		const b = generateRefreshToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(a).not.toBe(b);
	});

	it("hashes a token deterministically as 64 hex characters", async () => {
		const token = generateRefreshToken();
		const [a, b] = await Promise.all([hashToken(token), hashToken(token)]);
		expect(a).toMatch(/^[a-f0-9]{64}$/);
		expect(a).toBe(b);
		expect(a).not.toContain(token);
	});
});
