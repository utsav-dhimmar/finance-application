import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

// The __Host-/__Secure- prefixes are browser-enforced: __Host- requires the
// Secure flag, no Domain attribute, and path /; __Secure- requires Secure.
// They are set in addition to HttpOnly and SameSite=Lax.
export const ACCESS_COOKIE = "__Host-access_token";
export const REFRESH_COOKIE = "__Secure-refresh_token";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

const BASE_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: "Lax",
} as const;

export function issueSession(
	c: Context,
	accessToken: string,
	refreshToken: string,
): void {
	setCookie(c, ACCESS_COOKIE, accessToken, {
		...BASE_COOKIE_OPTIONS,
		path: "/",
		maxAge: ACCESS_TTL_SECONDS,
	});
	setCookie(c, REFRESH_COOKIE, refreshToken, {
		...BASE_COOKIE_OPTIONS,
		path: "/api/auth",
		maxAge: REFRESH_TTL_SECONDS,
	});
}

export function clearSession(c: Context): void {
	// Deletion Set-Cookie headers must repeat the Secure attribute: workerd
	// rejects clearing a __Host-/__Secure- cookie without it.
	deleteCookie(c, ACCESS_COOKIE, { path: "/", secure: true });
	deleteCookie(c, REFRESH_COOKIE, { path: "/api/auth", secure: true });
}

export function getAccessToken(c: Context): string | undefined {
	return getCookie(c, ACCESS_COOKIE);
}

export function getRefreshToken(c: Context): string | undefined {
	return getCookie(c, REFRESH_COOKIE);
}
