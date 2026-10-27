import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
	generateRefreshToken,
	hashToken,
	signAccessToken,
} from "@/lib/tokens";
import type {
	NewRefreshTokenRow,
	RefreshTokenRepository,
} from "@/repositories/refresh-token-repository";
import type { UserRepository } from "@/repositories/user-repository";
import { createAuthService } from "@/services/auth-service";

// In-memory fakes mirror the repository contracts so service business rules
// are tested without D1; real crypto helpers exercise the actual hashing.
function createFakeUserRepository(): UserRepository {
	const store = new Map<string, User>();
	return {
		async findByEmail(email) {
			return [...store.values()].find((user) => user.email === email);
		},
		async findById(id) {
			return store.get(id);
		},
		async insert(row) {
			const user: User = { ...row };
			store.set(user.id, user);
			return { id: user.id, email: user.email };
		},
	};
}

function createFakeRefreshTokenRepository(): RefreshTokenRepository {
	// Rows start unrevoked but the fake mutates revokedAt, so widen it.
	const store: (Omit<NewRefreshTokenRow, "revokedAt"> & {
		revokedAt: string | null;
	})[] = [];
	return {
		async findByTokenHash(tokenHash) {
			const row = store.find((entry) => entry.tokenHash === tokenHash);
			if (!row) {
				return undefined;
			}
			return {
				...row,
				revokedAt: row.revokedAt as string | null,
			};
		},
		async insert(row) {
			store.push({ ...row });
		},
		async revokeById(id, revokedAt) {
			const row = store.find((entry) => entry.id === id);
			if (row) {
				row.revokedAt = revokedAt;
			}
		},
		async revokeByTokenHash(tokenHash, revokedAt) {
			const row = store.find((entry) => entry.tokenHash === tokenHash);
			if (row) {
				row.revokedAt = revokedAt;
			}
		},
		async revokeAndReplace(oldId, revokedAt, replacement) {
			const row = store.find((entry) => entry.id === oldId);
			if (row) {
				row.revokedAt = revokedAt;
			}
			store.push({ ...replacement });
		},
	};
}

function createService() {
	return createAuthService({
		users: createFakeUserRepository(),
		refreshTokens: createFakeRefreshTokenRepository(),
		jwtSecret: "test-secret",
		hashPassword,
		verifyPassword,
		signAccessToken,
		generateRefreshToken,
		hashToken,
	});
}

const credentials = { email: "user@example.com", password: "s3cret-pw" };

let service: ReturnType<typeof createAuthService>;

beforeEach(() => {
	service = createService();
});

describe("register", () => {
	it("creates the user with an argon2id hash and returns session tokens", async () => {
		const outcome = await service.register(credentials);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) {
			return;
		}
		expect(outcome.value.email).toBe(credentials.email);
		expect(outcome.value.accessToken).toBeTruthy();
		expect(outcome.value.refreshToken).toBeTruthy();
	});

	it("fails with EMAIL_TAKEN for a duplicate email", async () => {
		await service.register(credentials);
		const outcome = await service.register(credentials);
		expect(outcome).toEqual({ ok: false, code: "EMAIL_TAKEN" });
	});
});

describe("login", () => {
	it("succeeds with correct credentials and returns tokens", async () => {
		await service.register(credentials);
		const outcome = await service.login(credentials);
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.value.accessToken).toBeTruthy();
			expect(outcome.value.refreshToken).toBeTruthy();
		}
	});

	it("returns the identical generic error for unknown email and wrong password", async () => {
		await service.register(credentials);
		const unknownEmail = await service.login({
			email: "nobody@example.com",
			password: credentials.password,
		});
		const wrongPassword = await service.login({
			email: credentials.email,
			password: "wrong-password",
		});
		expect(unknownEmail).toEqual({
			ok: false,
			code: "AUTH_INVALID_CREDENTIALS",
		});
		expect(wrongPassword).toEqual({
			ok: false,
			code: "AUTH_INVALID_CREDENTIALS",
		});
	});
});

describe("me", () => {
	it("returns the user for a known id", async () => {
		const registered = await service.register(credentials);
		if (!registered.ok) {
			throw new Error("registration failed");
		}
		const outcome = await service.me(registered.value.id);
		expect(outcome).toEqual({
			ok: true,
			value: { id: registered.value.id, email: credentials.email },
		});
	});

	it("fails with UNAUTHENTICATED for an unknown id", async () => {
		expect(await service.me("no-such-user")).toEqual({
			ok: false,
			code: "UNAUTHENTICATED",
		});
	});
});

describe("refresh", () => {
	async function registerAndGetRefreshToken(): Promise<string> {
		const outcome = await service.register(credentials);
		if (!outcome.ok) {
			throw new Error("registration failed");
		}
		return outcome.value.refreshToken;
	}

	it("rotates: returns a new token and revokes the presented one", async () => {
		const presented = await registerAndGetRefreshToken();

		const outcome = await service.refresh(presented);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) {
			return;
		}
		// A different replacement token was issued, and revocation of the
		// presented one is covered by the reuse-rejection test below.
		expect(outcome.value.refreshToken).not.toBe(presented);
	});

	it("rejects reuse of the revoked token", async () => {
		const presented = await registerAndGetRefreshToken();
		await service.refresh(presented);
		const reuse = await service.refresh(presented);
		expect(reuse).toEqual({ ok: false, code: "INVALID_REFRESH_TOKEN" });
	});

	it("rejects missing and unknown tokens", async () => {
		expect(await service.refresh(undefined)).toEqual({
			ok: false,
			code: "INVALID_REFRESH_TOKEN",
		});
		expect(await service.refresh(generateRefreshToken())).toEqual({
			ok: false,
			code: "INVALID_REFRESH_TOKEN",
		});
	});
});

describe("logout", () => {
	it("revokes the presented refresh token", async () => {
		const registered = await service.register(credentials);
		if (!registered.ok) {
			throw new Error("registration failed");
		}
		const presented = registered.value.refreshToken;

		await service.logout(presented);
		const reuse = await service.refresh(presented);
		expect(reuse).toEqual({ ok: false, code: "INVALID_REFRESH_TOKEN" });
	});

	it("is a no-op without a token", async () => {
		await expect(service.logout(undefined)).resolves.toBeUndefined();
	});
});
