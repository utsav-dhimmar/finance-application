import { sign, verify } from "hono/jwt";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload {
	sub: string;
	// The user's token version at issue time (0 for pre-upgrade tokens that
	// predate the claim); requireAuth rejects a mismatch, so a logout that
	// bumps the version revokes every outstanding access token immediately.
	ver: number;
	iat: number;
	exp: number;
}

export async function signAccessToken(
	userId: string,
	tokenVersion: number,
	secret: string,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	return sign(
		{
			sub: userId,
			ver: tokenVersion,
			iat: now,
			exp: now + ACCESS_TOKEN_TTL_SECONDS,
		},
		secret,
		"HS256",
	);
}

export async function verifyAccessToken(
	token: string,
	secret: string,
): Promise<AccessTokenPayload | null> {
	try {
		const payload = await verify(token, secret, "HS256");
		// Narrow the decoded payload explicitly: every claim the middleware
		// relies on is checked, so no unsafe cast is needed. Tokens issued
		// before the ver claim existed read as version 0, the database default.
		const version = typeof payload.ver === "number" ? payload.ver : 0;
		if (
			typeof payload.sub !== "string" ||
			typeof payload.iat !== "number" ||
			typeof payload.exp !== "number"
		) {
			return null;
		}
		return {
			sub: payload.sub,
			ver: version,
			iat: payload.iat,
			exp: payload.exp,
		};
	} catch {
		return null;
	}
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export function generateRefreshToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return bytesToBase64Url(bytes);
}

export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
