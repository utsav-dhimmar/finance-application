import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	server: {
		proxy: {
			"/api": {
				target: "http://127.0.0.1:8787",
				changeOrigin: true,
			},
		},
	},
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart({
			// SPA mode: the shell prerenders to _shell.html; a post-build step
			// copies it to index.html for Cloudflare's SPA asset fallback.
			spa: { enabled: true },
		}),
		viteReact(),
		// React Compiler: auto-memoizes components and values at build time.
		// plugin-react v6 dropped its inline babel option, so the compiler runs
		// as a follow-up rolldown-babel pass using the preset plugin-react v6
		// exports (see react.dev/learn/react-compiler/installation).
		babel({ presets: [reactCompilerPreset()] }),
	],
});

export default config;
