import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "@/db/schema";
import {
	DUMMY_PASSWORD_HASH,
	hashPassword,
	verifyPassword,
} from "@/lib/password";
import { generateRefreshToken, hashToken, signAccessToken } from "@/lib/tokens";
import type {
	NewRefreshTokenRow,
	RefreshTokenRepository,
} from "@/repositories/refresh-token-repository";
import type { UserRepository } from "@/repositories/user-repository";
import { createAuthService } from "@/services/auth-service";
import { isoNow } from "@/utils/datetime";

// In-memory fakes mirror the repository contracts so service business rules
// are tested without D1; real crypto helpers exercise the actual hashing.
function createFakeUserRepository(store: Map<string, User>): UserRepository {
	return {
		async findByEmail(email) {
			return [...store.values()].find((user) => user.email === email);
		},
		async findById(id) {
			return store.get(id);
		},
		async insert(row) {
			const user: User = { ...row, tokenVersion: 0 };
			store.set(user.id, user);
			return { id: user.id, email: user.email };
		},
	};
}

function createFakeRefreshTokenRepository(
	users: Map<string, User>,
): RefreshTokenRepository {
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
		// Mirrors the real guard: rotation succeeds only when the presented
		// token row is still unrevoked, and only the winner inserts a
		// replacement.
		async revokeAndReplace(oldId, revokedAt, replacement) {
			const row = store.find((entry) => entry.id === oldId);
			if (!row || row.revokedAt !== null) {
				return false;
			}
			row.revokedAt = revokedAt;
			store.push({ ...replacement });
			return true;
		},
		async revokeAndBumpVersion(userId, tokenId, revokedAt) {
			const row = store.find((entry) => entry.id === tokenId);
			if (row) {
				row.revokedAt = revokedAt;
			}
			const user = users.get(userId);
			if (user) {
				user.tokenVersion += 1;
			}
		},
		async purgeStale() {},
	};
}

// Seeds a user directly (registration is disabled at the API): the fake user
// repository keeps the row so login can run against real PBKDF2 hashing.
function createService() {
	const userStore = new Map<string, User>();
	const verifyCalls: { password: string; hash: string }[] = [];
	const seedUser = (overrides: Partial<User> & { id: string }): User => {
		const user: User = {
			email: "user@example.com",
			passwordHash: "",
			tokenVersion: 0,
			createdAt: isoNow(),
			updatedAt: isoNow(),
			...overrides,
		};
		userStore.set(user.id, user);
		return user;
	};
	const service = createAuthService({
		users: createFakeUserRepository(userStore),
		refreshTokens: createFakeRefreshTokenRepository(userStore),
		jwtSecret: "test-secret",
		// Wraps the real verifier to observe that verification work happened
		// (the uniform-login-work guarantee) without depending on wall-clock
		// timings of the derivation itself.
		verifyPassword: async (password, hash) => {
			verifyCalls.push({ password, hash });
			return verifyPassword(password, hash);
		},
		signAccessToken,
		generateRefreshToken,
		hashToken,
	});
	return { service, seedUser, verifyCalls };
}

const credentials = { email: "user@example.com", password: "s3cret-pw" };

let service: ReturnType<typeof createService>["service"];
let seedUser: ReturnType<typeof createService>["seedUser"];
let verifyCalls: ReturnType<typeof createService>["verifyCalls"];

beforeEach(() => {
	const created = createService();
	service = created.service;
	seedUser = created.seedUser;
	verifyCalls = created.verifyCalls;
});

describe("login", () => {
	it("succeeds with correct credentials and returns tokens", async () => {
		const user = seedUser({ id: "user-1", email: credentials.email });
		user.passwordHash = await hashPassword(credentials.password);
		const outcome = await service.login(credentials);
		expect(outcome.ok).toBe(true);
		if (outcome.ok) {
			expect(outcome.value.id).toBe(user.id);
			expect(outcome.value.accessToken).toBeTruthy();
			expect(outcome.value.refreshToken).toBeTruthy();
		}
	});

	it("returns the identical generic error for unknown email and wrong password", async () => {
		seedUser({ id: "user-1", email: credentials.email }).passwordHash =
			await hashPassword(credentials.password);
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

	it("performs hashing work for an unknown email before failing", async () => {
		// The dummy hash embedded in lib/password verifies at full cost (it
		// simply never matches — its throwaway password was discarded at
		// generation), so unknown-email attempts cannot be distinguished from
		// wrong-password attempts by their work.
		const outcome = await service.login({
			email: "nobody@example.com",
			password: credentials.password,
		});
		expect(outcome).toEqual({ ok: false, code: "AUTH_INVALID_CREDENTIALS" });
		// The uniform-work guarantee, observed directly: the submitted password
		// was really verified against the dummy hash, not skipped.
		expect(verifyCalls).toContainEqual({
			password: credentials.password,
			hash: DUMMY_PASSWORD_HASH,
		});
	});
});

describe("me", () => {
	it("returns the user for a known id", async () => {
		const user = seedUser({ id: "user-1", email: credentials.email });
		const outcome = await service.me(user.id);
		expect(outcome).toEqual({
			ok: true,
			value: { id: user.id, email: credentials.email },
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
	async function seedAndGetRefreshToken(): Promise<string> {
		seedUser({ id: "user-1", email: credentials.email }).passwordHash =
			await hashPassword(credentials.password);
		const outcome = await service.login(credentials);
		if (!outcome.ok) {
			throw new Error("login failed");
		}
		return outcome.value.refreshToken;
	}

	it("rotates: returns a new token and revokes the presented one", async () => {
		const presented = await seedAndGetRefreshToken();

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
		const presented = await seedAndGetRefreshToken();
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
	it("revokes the presented refresh token and bumps the token version", async () => {
		const user = seedUser({ id: "user-1", email: credentials.email });
		user.passwordHash = await hashPassword(credentials.password);
		const loginOutcome = await service.login(credentials);
		if (!loginOutcome.ok) {
			throw new Error("login failed");
		}
		const { refreshToken } = loginOutcome.value;
		expect(user.tokenVersion).toBe(0);

		await service.logout(refreshToken);
		const reuse = await service.refresh(refreshToken);
		expect(reuse).toEqual({ ok: false, code: "INVALID_REFRESH_TOKEN" });
		// The version bump is observable on the user row: every access token
		// issued before the logout carries the stale version and stops working.
		expect(user.tokenVersion).toBe(1);
	});

	it("is a no-op without a token", async () => {
		await expect(service.logout(undefined)).resolves.toBeUndefined();
	});
});
