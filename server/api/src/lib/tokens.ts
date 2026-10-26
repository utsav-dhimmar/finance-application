import { sign, verify } from "hono/jwt";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload {
	sub: string;
	iat: number;
	exp: number;
}

export async function signAccessToken(
	userId: string,
	secret: string,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	return sign(
		{ sub: userId, iat: now, exp: now + ACCESS_TOKEN_TTL_SECONDS },
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
		if (typeof payload.sub !== "string") {
			return null;
		}
		return payload as unknown as AccessTokenPayload;
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
