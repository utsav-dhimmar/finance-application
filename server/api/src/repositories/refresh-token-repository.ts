import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { refreshTokens, type RefreshToken } from "@/db/schema";

export interface NewRefreshTokenRow {
	id: string;
	userId: string;
	tokenHash: string;
	expiresAt: string;
	revokedAt: null;
	createdAt: string;
}

export function createRefreshTokenRepository(db: Db) {
	return {
		async findByTokenHash(tokenHash: string): Promise<RefreshToken | undefined> {
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

		async revokeByTokenHash(tokenHash: string, revokedAt: string): Promise<void> {
			await db
				.update(refreshTokens)
				.set({ revokedAt })
				.where(eq(refreshTokens.tokenHash, tokenHash));
		},

		// Rotation must revoke the presented token and store its replacement
		// atomically; D1 batches run as an implicit transaction.
		async revokeAndReplace(
			oldId: string,
			revokedAt: string,
			replacement: NewRefreshTokenRow,
		): Promise<void> {
			await db.batch([
				db
					.update(refreshTokens)
					.set({ revokedAt })
					.where(eq(refreshTokens.id, oldId)),
				db.insert(refreshTokens).values(replacement),
			]);
		},
	};
}

export type RefreshTokenRepository = ReturnType<
	typeof createRefreshTokenRepository
>;
