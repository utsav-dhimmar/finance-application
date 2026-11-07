import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The `_headers` file ships with the SPA assets (Vite copies `apps/web/public`
// into `dist/client`) and the Cloudflare assets layer applies its rules to
// every non-API response — including SPA-fallback 200s. The runtime behavior
// is a platform feature; this test pins the shipped rules themselves.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function parseHeadersFile(): Map<string, string> {
	const content = readFileSync(
		resolve(repoRoot, "apps/web/public/_headers"),
		"utf8",
	);
	const headers = new Map<string, string>();
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		const separator = trimmed.indexOf(":");
		if (trimmed.length === 0 || trimmed.startsWith("/") || separator < 0) {
			continue;
		}
		headers.set(
			trimmed.slice(0, separator).toLowerCase(),
			trimmed.slice(separator + 1).trim(),
		);
	}
	return headers;
}

describe("shipped static-asset security headers", () => {
	it("apply the required headers to every asset path", () => {
		const headers = parseHeadersFile();
		expect(headers.get("x-frame-options")).toBe("DENY");
		expect(headers.get("x-content-type-options")).toBe("nosniff");
		expect(headers.get("referrer-policy")).toBe(
			"strict-origin-when-cross-origin",
		);
	});

	it("match all paths, including SPA-fallback responses", () => {
		const content = readFileSync(
			resolve(repoRoot, "apps/web/public/_headers"),
			"utf8",
		);
		expect(content.trim().split("\n")[0]?.trim()).toBe("/*");
	});
});
