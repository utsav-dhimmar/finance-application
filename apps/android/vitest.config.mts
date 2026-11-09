import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		// Scaffold window: unit tests arrive with the session layer (tasks 4.x).
		passWithNoTests: true,
	},
});
