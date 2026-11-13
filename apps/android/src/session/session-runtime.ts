import type { SessionMachine } from "./session-machine";

// The data layer's single access point to the session: services resolve the
// machine through this holder so every authenticated request flows through
// SessionMachine.run() and keeps the single-flight refresh semantics. The
// provider registers the one instance at boot; tests register their own.
let machine: SessionMachine | null = null;

export function registerSessionMachine(instance: SessionMachine): void {
	machine = instance;
}

export function sessionMachine(): SessionMachine {
	if (machine === null) {
		throw new Error(
			"Session machine is not registered. The session provider must run before any data request.",
		);
	}
	return machine;
}

/** Test-only reset so each test registers a fresh machine. */
export function resetSessionRuntime(): void {
	machine = null;
}
