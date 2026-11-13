import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import { resolveApiBaseUrl } from "./api-config";
import { AuthSession } from "./auth-session";
import { CookieJar } from "./cookie-jar";
import { createSecureCookieStore } from "./secure-store-adapter";
import { SessionMachine, type SessionState } from "./session-machine";
import { registerSessionMachine } from "./session-runtime";

interface SessionContextValue {
	state: SessionState;
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Binds the platform-independent SessionMachine to React: creates it once
 * with the configured API base URL and the secure cookie store, restores the
 * session on mount, and publishes state changes to consumers. The machine is
 * also registered with the data layer so services can route every request
 * through SessionMachine.run().
 */
export function SessionProvider({ children }: { children: ReactNode }) {
	const [machine] = useState(() => {
		const baseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
		const auth = new AuthSession(
			new CookieJar(createSecureCookieStore()),
			baseUrl,
		);
		const created = new SessionMachine(auth);
		registerSessionMachine(created);
		return created;
	});

	const state = useSyncExternalStore(
		(listener) => machine.subscribe(listener),
		() => machine.getState(),
	);

	useEffect(() => {
		void machine.restore();
	}, [machine]);

	const value = useMemo<SessionContextValue>(
		() => ({
			state,
			signIn: (email: string, password: string) =>
				machine.signIn(email, password),
			signOut: () => machine.signOut(),
		}),
		[machine, state],
	);

	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
}

export function useSession(): SessionContextValue {
	const value = useContext(SessionContext);
	if (value === null) {
		throw new Error("useSession must be used within a SessionProvider");
	}
	return value;
}
