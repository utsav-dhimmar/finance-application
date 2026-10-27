import type { ErrorCode } from "@/lib/error";
import type { hashPassword, verifyPassword } from "@/lib/password";
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

// Each method fails with exactly one code so controllers can map it to a
// literal response status.
export type RegisterOutcome = AuthOutcome<
	PublicUser & SessionTokens,
	"EMAIL_TAKEN"
>;
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
	hashPassword: typeof hashPassword;
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

	async function startSession(userId: string): Promise<SessionTokens> {
		const [accessToken, refreshToken] = await Promise.all([
			deps.signAccessToken(userId, jwtSecret),
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
		async register(input: CredentialsInput): Promise<RegisterOutcome> {
			const existing = await users.findByEmail(input.email);
			if (existing) {
				return { ok: false, code: "EMAIL_TAKEN" };
			}

			const user = await users.insert({
				id: uuidV7(),
				email: input.email,
				passwordHash: deps.hashPassword(input.password),
				createdAt: isoNow(),
				updatedAt: isoNow(),
			});

			const session = await startSession(user.id);
			return { ok: true, value: { ...user, ...session } };
		},

		async login(input: CredentialsInput): Promise<LoginOutcome> {
			const user = await users.findByEmail(input.email);
			const passwordMatches =
				user !== undefined &&
				deps.verifyPassword(input.password, user.passwordHash);
			if (user === undefined || !passwordMatches) {
				return { ok: false, code: "AUTH_INVALID_CREDENTIALS" };
			}

			const session = await startSession(user.id);
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
			await refreshTokens.revokeAndReplace(record.id, nowIso, {
				id: uuidV7(),
				userId: record.userId,
				tokenHash: await deps.hashToken(replacementToken),
				expiresAt: refreshExpiryIso(),
				revokedAt: null,
				createdAt: nowIso,
			});

			const user = await users.findById(record.userId);
			if (!user) {
				return { ok: false, code: "INVALID_REFRESH_TOKEN" };
			}

			const accessToken = await deps.signAccessToken(user.id, jwtSecret);
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
		// cleared session.
		async logout(presentedToken: string | undefined): Promise<void> {
			if (!presentedToken) {
				return;
			}
			await refreshTokens.revokeByTokenHash(
				await deps.hashToken(presentedToken),
				isoNow(),
			);
		},
	};
}

export type AuthService = ReturnType<typeof createAuthService>;
