import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Pure node-environment suite with self-contained tests; tests do not
		// depend on per-file module state, so per-file worker isolation is
		// unnecessary overhead in CI.
		isolate: false,
	},
});
