import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./migrations",
	dialect: "sqlite",
	schema: "./src/db/schema.ts",
});
