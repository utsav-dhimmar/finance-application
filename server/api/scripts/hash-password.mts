// One-time migration helper for the PBKDF2 switch (see the OpenSpec change
// switch-password-hashing-to-pbkdf2): hashes a password with the production
// PBKDF2 parameters and prints a ready-to-run wrangler command for the remote
// D1 database.
//
// By default the password is read from stdin and never echoed, logged, or
// accepted on the command line. Type it and press Ctrl+D, or pipe it in:
//
//   node scripts/hash-password.mts --email you@example.org
//   printf '%s' 'the-password' | node scripts/hash-password.mts --email you@example.org
//
// For convenience --password accepts the password directly:
//
//   node scripts/hash-password.mts --email you@example.org --password 'the-password'
//
// --password is convenient but leaves the password in your shell history and
// process list; the script warns and proceeds. The stdin prompt leaves no
// trace.
//
// Run this BEFORE deploying the PBKDF2-only worker — until the stored hash is
// migrated, login cannot succeed. Save the current hash first (command
// printed below) so the old worker version remains usable for rollback.
import {
	DEFAULT_ITERATIONS,
	hashPassword,
	MAX_VERIFIED_ITERATIONS,
} from "../src/lib/password.ts";

interface ScriptArgs {
	iterations: number | undefined;
	email: string | undefined;
	password: string | undefined;
	help: boolean;
}

function parseArgs(argv: readonly string[]): ScriptArgs {
	const args: ScriptArgs = {
		iterations: undefined,
		email: undefined,
		password: undefined,
		help: false,
	};
	const value = (flag: string, index: number): string => {
		const withEquals = flag.split("=");
		if (withEquals.length === 2) {
			return withEquals[1] ?? "";
		}
		const next = argv[index + 1];
		if (next === undefined) {
			console.error(`Missing value for ${flag.split("=")[0]}`);
			process.exit(2);
		}
		return next;
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			args.help = true;
		} else if (arg === "--iterations" || arg?.startsWith("--iterations=")) {
			const raw = value(arg, i);
			const parsed = Number(raw);
			if (arg === "--iterations") {
				i += 1;
			}
			args.iterations = parsed;
		} else if (arg === "--email" || arg?.startsWith("--email=")) {
			args.email = value(arg, i);
			if (arg === "--email") {
				i += 1;
			}
		} else if (arg === "--password" || arg?.startsWith("--password=")) {
			args.password = value(arg, i);
			if (arg === "--password") {
				i += 1;
			}
		} else {
			console.error(`Unknown argument: ${arg ?? ""}`);
			process.exit(2);
		}
	}
	return args;
}

function usage(): string {
	return [
		"Usage: node scripts/hash-password.mts [--iterations N] [--email login@example.org] [--password PASSWORD]",
		"",
		"Reads the password from stdin (finish with Ctrl+D, or pipe it in) unless",
		"--password is given, and prints the PBKDF2 hash plus the wrangler d1 execute",
		"command that stores it for the account with the given --email. --password is",
		"convenient but lands in your shell history and process list; the stdin",
		"prompt does not.",
	].join("\n");
}

function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => {
			resolve(data);
		});
		process.stdin.on("error", (error) => {
			reject(error);
		});
	});
}

// For the dummy-work constant: a throwaway password that is hashed and then
// discarded — it is never printed, so nothing can authenticate against the
// resulting hash (mirrors how DUMMY_PASSWORD_HASH was produced).
function randomDiscardedPassword(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join(
		"",
	);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
	console.log(usage());
	process.exit(0);
}

const iterations = args.iterations ?? DEFAULT_ITERATIONS;
if (
	!Number.isInteger(iterations) ||
	iterations < 1 ||
	iterations > MAX_VERIFIED_ITERATIONS
) {
	console.error(
		`--iterations must be an integer between 1 and ${MAX_VERIFIED_ITERATIONS}`,
	);
	process.exit(2);
}

let password: string;
if (args.password !== undefined) {
	process.stderr.write(
		"WARNING: --password places the password in your shell history and process list. Prefer the stdin prompt when practical.\n",
	);
	password = args.password;
} else {
	process.stderr.write(
		"Enter the password, then press Ctrl+D (input is not echoed):\n",
	);
	password = (await readStdin()).replace(/\r?\n$/, "");
}
if (!password) {
	console.error(
		"No password provided (stdin was empty, or --password was empty).",
	);
	process.exit(1);
}

const started = performance.now();
const hash = await hashPassword(password, iterations);
const elapsedMs = performance.now() - started;

console.log(
	`Password hash (PBKDF2-HMAC-SHA256, ${iterations} iterations, ${elapsedMs.toFixed(1)} ms locally; budget: 10 ms on Workers free):\n`,
);
console.log(hash);
console.log(
	"\nSave the current production hash first (rollback), then apply the new one:",
);
console.log(
	'  wrangler d1 execute finance-application --remote --command "SELECT id, email, password_hash FROM users"',
);
console.log("\nStore the new hash (requires wrangler authentication):");
const email = args.email ?? "<your-login-email>";
console.log(
	`  wrangler d1 execute finance-application --remote --command "UPDATE users SET password_hash = '${hash}' WHERE email = '${email}'"`,
);
console.log(
	"\nRun this BEFORE deploying the PBKDF2-only worker; until the stored hash is migrated, login cannot succeed.",
);

if (iterations !== DEFAULT_ITERATIONS) {
	const dummy = await hashPassword(randomDiscardedPassword(), iterations);
	console.log(
		`\nAt ${iterations} iterations the embedded dummy constant must match, or unknown-email\nattempts no longer cost the same as wrong-password attempts. Replace\nDUMMY_PASSWORD_HASH in src/lib/password.ts with:\n\n  ${dummy}`,
	);
}
