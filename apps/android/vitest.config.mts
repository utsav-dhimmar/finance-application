import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { reactNative } from "vitest-native";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [
		// Runs React Native component/hook tests under Vitest: resolves the
		// react-native environment, native-module mocks, and Expo modules.
		reactNative(),
	],
	resolve: {
		alias: {
			"@": path.resolve(rootDir, "./src"),
			"@tests": path.resolve(rootDir, "./tests"),
		},
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.{ts,tsx}"],
		setupFiles: ["tests/setup.ts"],
		// The native engine boots a real React Native per file; keep the
		// per-test budget generous enough for that startup cost.
		testTimeout: 20_000,
	},
});
