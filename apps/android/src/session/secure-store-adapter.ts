import * as SecureStore from "expo-secure-store";

import type { CookieStore, SessionCookies } from "./cookie-jar";

const SESSION_KEY = "finance.session.cookies";

function isSessionCookies(value: unknown): value is SessionCookies {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	return (
		"accessToken" in value &&
		typeof value.accessToken === "string" &&
		"refreshToken" in value &&
		typeof value.refreshToken === "string"
	);
}

/**
 * CookieStore backed by the platform secure storage (device keystore /
 * keychain). Corrupt stored data is treated as no session; storage I/O
 * failures propagate so callers can surface them as an error state.
 */
export function createSecureCookieStore(): CookieStore {
	return {
		async load(): Promise<SessionCookies | null> {
			const raw = await SecureStore.getItemAsync(SESSION_KEY);
			if (raw === null) {
				return null;
			}
			try {
				const parsed: unknown = JSON.parse(raw);
				if (isSessionCookies(parsed)) {
					return parsed;
				}
				return null;
			} catch {
				return null;
			}
		},
		async save(cookies: SessionCookies): Promise<void> {
			await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(cookies));
		},
		async clear(): Promise<void> {
			await SecureStore.deleteItemAsync(SESSION_KEY);
		},
	};
}
