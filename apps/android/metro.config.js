const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Monorepo: resolve workspace packages via their "exports" fields, watch the
// whole repository so edits in workspace packages rebuild the app, and look
// for dependencies in both the app's and the repo root's node_modules.
config.resolver.unstable_enablePackageExports = true;
config.watchFolders = [path.resolve(__dirname, "../..")];
config.resolver.nodeModulesPaths = [
	path.resolve(__dirname, "node_modules"),
	path.resolve(__dirname, "../../node_modules"),
];

module.exports = config;
