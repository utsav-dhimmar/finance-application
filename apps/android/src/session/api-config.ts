/** Raised at startup when EXPO_PUBLIC_API_URL is not configured. */
export class MissingApiUrlError extends Error {
	constructor() {
		super(
			"EXPO_PUBLIC_API_URL is not set. Set it to the API base URL (for local device development, your machine's LAN address such as http://192.168.1.10:8787) before starting the app. On Android emulators, http://10.0.2.2:<port> reaches the host machine.",
		);
		this.name = "MissingApiUrlError";
	}
}

/**
 * Resolves the API base URL from build-time environment configuration.
 * Trailing slashes are stripped so path joins never double up. Throws
 * MissingApiUrlError when unset so the app fails fast with an actionable
 * message instead of sending requests to a default host.
 */
export function resolveApiBaseUrl(env: string | undefined): string {
	if (env === undefined || env.trim().length === 0) {
		throw new MissingApiUrlError();
	}
	return env.trim().replace(/\/+$/, "");
}
