import { type D1Migration, readD1Migrations } from "@cloudflare/vitest-plugin";
import type { ProvidedContext } from "vitest";

declare module "vitest" {
	interface ProvidedContext {
		d1Migrations: D1Migration[];
	}
}

export default async function ({
	provide,
}: {
	provide: <K extends keyof ProvidedContext & string>(
		key: K,
		value: ProvidedContext[K],
	) => void;
}) {
	const migrations = await readD1Migrations("migrations");
	provide("d1Migrations", migrations);
}
