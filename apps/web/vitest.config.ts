import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url).href),
		},
	},
	test: {
		environment: "jsdom",
		// Reuse one jsdom environment per worker instead of rebuilding it for
		// every test file (CI showed jsdom creation as 37% of test time).
		// vmThreads keeps a fresh window per file, preserving isolation.
		pool: "vmThreads",
		include: ["tests/**/*.test.{ts,tsx}"],
	},
});
