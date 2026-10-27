import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url).href),
		},
	},
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: {
					JWT_SECRET: "test-secret-for-workers-pool",
				},
			},
		}),
	],
	test: {
		include: [
			"tests/auth/**/*.test.ts",
			"tests/repositories/**/*.test.ts",
		],
		globalSetup: ["./tests/auth/globalSetup.mts"],
		setupFiles: ["./tests/auth/setup.ts"],
	},
});
