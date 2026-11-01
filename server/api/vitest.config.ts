import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url).href),
		},
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		exclude: [
			"tests/auth/**",
			"tests/repositories/**",
			"tests/accounts/**",
			"**/node_modules/**",
		],
	},
});
