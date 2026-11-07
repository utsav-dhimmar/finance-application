// Fixed-window rate limiting for the auth endpoints via the Workers
// rate-limiting binding. The binding's threshold is configured in
// wrangler.jsonc (10 requests per 60 seconds); keys separate concerns:
// login keys include the submitted email so one IP cannot lock out another
// account's attempts, register and refresh key on the client IP.

export interface RateLimiterBinding {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitEnv {
	RATE_LIMITER?: RateLimiterBinding;
}

export function authClientIp(headers: Headers): string {
	// Cloudflare sets this header on every request to the Worker; requests
	// without it (direct miniflare tests) share one unknown-IP bucket.
	return headers.get("cf-connecting-ip") ?? "unknown";
}

// True when the request may proceed. Missing binding (unit tests, bare
// miniflare without the binding) fails open: limiting is configured in
// wrangler.jsonc and always present in deployed environments.
export async function allowAuthRequest(
	env: RateLimitEnv,
	key: string,
): Promise<boolean> {
	const binding = env.RATE_LIMITER;
	if (!binding) {
		return true;
	}
	const result = await binding.limit({ key });
	return result.success;
}
