import type { ErrorCode } from "@/lib/error";
import type { verifyPassword } from "@/lib/password";
import { DUMMY_PASSWORD_HASH } from "@/lib/password";
import type {
	generateRefreshToken,
	hashToken,
	signAccessToken,
} from "@/lib/tokens";
import { uuidV7 } from "@/lib/uuid";
import type { RefreshTokenRepository } from "@/repositories/refresh-token-repository";
import type { UserRepository } from "@/repositories/user-repository";
import { isoNow, refreshExpiryIso } from "@/utils/datetime";

export interface PublicUser {
	id: string;
	email: string;
}

export interface SessionTokens {
	accessToken: string;
	refreshToken: string;
}

export type AuthOutcome<T, E extends ErrorCode> =
	| { ok: true; value: T }
	| { ok: false; code: E };

// Registration is disabled at the route layer (single-user product); the
// service exposes no register method to call.
export type LoginOutcome = AuthOutcome<
	PublicUser & SessionTokens,
	"AUTH_INVALID_CREDENTIALS"
>;
export type MeOutcome = AuthOutcome<PublicUser, "UNAUTHENTICATED">;
export type RefreshOutcome = AuthOutcome<
	PublicUser & SessionTokens,
	"INVALID_REFRESH_TOKEN"
>;

export interface AuthServiceDeps {
	users: UserRepository;
	refreshTokens: RefreshTokenRepository;
	jwtSecret: string;
	verifyPassword: typeof verifyPassword;
	signAccessToken: typeof signAccessToken;
	generateRefreshToken: typeof generateRefreshToken;
	hashToken: typeof hashToken;
}

export interface CredentialsInput {
	email: string;
	password: string;
}

export function createAuthService(deps: AuthServiceDeps) {
	const { users, refreshTokens, jwtSecret } = deps;

	async function startSession(
		userId: string,
		tokenVersion: number,
	): Promise<SessionTokens> {
		const [accessToken, refreshToken] = await Promise.all([
			deps.signAccessToken(userId, tokenVersion, jwtSecret),
			createRefreshTokenRecord(userId),
		]);
		return { accessToken, refreshToken };
	}

	async function createRefreshTokenRecord(userId: string): Promise<string> {
		const token = deps.generateRefreshToken();
		await refreshTokens.insert({
			id: uuidV7(),
			userId,
			tokenHash: await deps.hashToken(token),
			expiresAt: refreshExpiryIso(),
			revokedAt: null,
			createdAt: isoNow(),
		});
		return token;
	}

	return {
		async login(input: CredentialsInput): Promise<LoginOutcome> {
			const user = await users.findByEmail(input.email);
			// Unknown emails verify against a fixed dummy hash so the request
			// performs the same password-hashing work as a real check and
			// response cost does not reveal whether the account exists.
			if (user === undefined) {
				await deps.verifyPassword(input.password, DUMMY_PASSWORD_HASH);
				return { ok: false, code: "AUTH_INVALID_CREDENTIALS" };
			}
			if (!(await deps.verifyPassword(input.password, user.passwordHash))) {
				return { ok: false, code: "AUTH_INVALID_CREDENTIALS" };
			}

			// Bound refresh-token storage growth as part of the request that
			// would otherwise add a row; a purge failure must not fail the login.
			try {
				await refreshTokens.purgeStale(user.id, isoNow());
			} catch {
				// Retention is best-effort; the next successful login retries.
			}

			const session = await startSession(user.id, user.tokenVersion);
			return {
				ok: true,
				value: { id: user.id, email: user.email, ...session },
			};
		},

		async me(userId: string): Promise<MeOutcome> {
			const user = await users.findById(userId);
			if (!user) {
				return { ok: false, code: "UNAUTHENTICATED" };
			}
			return { ok: true, value: { id: user.id, email: user.email } };
		},

		async refresh(presentedToken: string | undefined): Promise<RefreshOutcome> {
			if (!presentedToken) {
				return { ok: false, code: "INVALID_REFRESH_TOKEN" };
			}
			const tokenHash = await deps.hashToken(presentedToken);
			const record = await refreshTokens.findByTokenHash(tokenHash);
			const nowIso = isoNow();
			const isUsable =
				record !== undefined &&
				record.revokedAt === null &&
				record.expiresAt > nowIso;
			if (!isUsable || record === undefined) {
				return { ok: false, code: "INVALID_REFRESH_TOKEN" };
			}

			const replacementToken = deps.generateRefreshToken();
			const rotated = await refreshTokens.revokeAndReplace(record.id, nowIso, {
				id: uuidV7(),
				userId: record.userId,
				tokenHash: await deps.hashToken(replacementToken),
				expiresAt: refreshExpiryIso(),
				revokedAt: null,
				createdAt: nowIso,
			});
			// Lost the single-use rotation race: the token was already rotated
			// (or replayed), so no second session is issued.
			if (!rotated) {
				return { ok: false, code: "INVALID_REFRESH_TOKEN" };
			}

			const user = await users.findById(record.userId);
			if (!user) {
				return { ok: false, code: "INVALID_REFRESH_TOKEN" };
			}

			try {
				await refreshTokens.purgeStale(user.id, isoNow());
			} catch {
				// Retention is best-effort; the next successful login retries.
			}

			const accessToken = await deps.signAccessToken(
				user.id,
				user.tokenVersion,
				jwtSecret,
			);
			return {
				ok: true,
				value: {
					id: user.id,
					email: user.email,
					accessToken,
					refreshToken: replacementToken,
				},
			};
		},

		// Logout is idempotent: no cookie or an unknown token still ends in a
		// cleared session, and no token version changes.
		async logout(presentedToken: string | undefined): Promise<void> {
			if (!presentedToken) {
				return;
			}
			const tokenHash = await deps.hashToken(presentedToken);
			const record = await refreshTokens.findByTokenHash(tokenHash);
			if (!record) {
				return;
			}
			// Bumping the user's token version revokes every outstanding access
			// token immediately instead of letting it ride out its TTL.
			await refreshTokens.revokeAndBumpVersion(
				record.userId,
				record.id,
				isoNow(),
			);
		},
	};
}

export type AuthService = ReturnType<typeof createAuthService>;
