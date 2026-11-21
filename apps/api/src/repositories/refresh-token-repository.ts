import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { type RefreshToken, refreshTokens, users } from "@/db/schema";

export interface NewRefreshTokenRow {
	id: string;
	userId: string;
	tokenHash: string;
	expiresAt: string;
	revokedAt: null;
	createdAt: string;
}

// Refresh tokens revoked more than this long ago are candidates for the
// opportunistic purge; unexpired tokens are always kept.
export const REVOKED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function createRefreshTokenRepository(db: Db) {
	return {
		async findByTokenHash(
			tokenHash: string,
		): Promise<RefreshToken | undefined> {
			const found = await db
				.select()
				.from(refreshTokens)
				.where(eq(refreshTokens.tokenHash, tokenHash))
				.limit(1);
			return found[0];
		},

		async insert(row: NewRefreshTokenRow): Promise<void> {
			await db.insert(refreshTokens).values(row);
		},

		async revokeById(id: string, revokedAt: string): Promise<void> {
			await db
				.update(refreshTokens)
				.set({ revokedAt })
				.where(eq(refreshTokens.id, id));
		},

		async revokeByTokenHash(
			tokenHash: string,
			revokedAt: string,
		): Promise<void> {
			await db
				.update(refreshTokens)
				.set({ revokedAt })
				.where(eq(refreshTokens.tokenHash, tokenHash));
		},

		// Rotation must be single-use under concurrency: the revoked_at IS NULL
		// guard matches exactly one caller, and only that caller stores the
		// replacement. D1 serializes writes, so a concurrent presenter of the
		// same token loses the guard and is rejected instead of double-issuing
		// sessions. Returns false when the token was already revoked; the
		// replacement insert is skipped in that case.
		async revokeAndReplace(
			oldId: string,
			revokedAt: string,
			replacement: NewRefreshTokenRow,
		): Promise<boolean> {
			const revoked = await db
				.update(refreshTokens)
				.set({ revokedAt })
				.where(
					and(eq(refreshTokens.id, oldId), isNull(refreshTokens.revokedAt)),
				)
				.returning({ id: refreshTokens.id });
			if (revoked.length === 0) {
				return false;
			}
			await db.insert(refreshTokens).values(replacement);
			return true;
		},

		// Logout revokes the presented refresh token and bumps the user's token
		// version in one atomic batch, so every outstanding access token for the
		// user stops verifying the moment the logout commits.
		async revokeAndBumpVersion(
			userId: string,
			tokenId: string,
			revokedAt: string,
		): Promise<void> {
			await db.batch([
				db
					.update(refreshTokens)
					.set({ revokedAt })
					.where(eq(refreshTokens.id, tokenId)),
				db
					.update(users)
					.set({
						tokenVersion: sql`${users.tokenVersion} + 1`,
						updatedAt: revokedAt,
					})
					.where(eq(users.id, userId)),
			]);
		},

		// Opportunistic retention bound: expired tokens and tokens revoked more
		// than REVOKED_RETENTION_MS ago are deleted, so the table cannot grow
		// without limit. Called after successful login/refresh.
		async purgeStale(userId: string, nowIso: string): Promise<void> {
			const revokedCutoff = new Date(
				Date.parse(nowIso) - REVOKED_RETENTION_MS,
			).toISOString();
			await db
				.delete(refreshTokens)
				.where(
					and(
						eq(refreshTokens.userId, userId),
						or(
							lt(refreshTokens.expiresAt, nowIso),
							and(
								sql`${refreshTokens.revokedAt} IS NOT NULL`,
								lt(refreshTokens.revokedAt, revokedCutoff),
							),
						),
					),
				);
		},
	};
}

export type RefreshTokenRepository = ReturnType<
	typeof createRefreshTokenRepository
>;
