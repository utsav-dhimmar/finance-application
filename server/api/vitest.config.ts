import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url).href),
		},
	},
	test: {
		// Argon2id-heavy auth tests flake at the 5 s default when the full
		// turbo pipeline saturates the CPU.
		testTimeout: 30_000,
		environment: "node",
		include: ["tests/**/*.test.ts"],
		exclude: [
			"tests/auth/**",
			"tests/repositories/**",
			"tests/accounts/**",
			"tests/categories/**",
			"tests/transactions/**",
			"tests/transfers/**",
			"tests/reports/**",
			"tests/lifecycle/**",
			"tests/preferences/**",
			"**/node_modules/**",
		],
	},
});
