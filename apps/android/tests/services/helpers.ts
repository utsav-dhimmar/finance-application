import { afterEach, vi } from "vitest";

import { AuthSession } from "@/session/auth-session";
import {
	CookieJar,
	type CookieStore,
	type SessionCookies,
} from "@/session/cookie-jar";
import {
	API_BASE,
	type FetchHandler,
	stubFetchRouter,
} from "@/session/fetch-mock";
import { SessionMachine } from "@/session/session-machine";
import {
	registerSessionMachine,
	resetSessionRuntime,
} from "@/session/session-runtime";

export const ACCESS = "access-value-123";
export const REFRESH = "refresh-value-456";

export class MemoryStore implements CookieStore {
	data: SessionCookies | null = null;
	saves = 0;
	clears = 0;

	async load(): Promise<SessionCookies | null> {
		return this.data;
	}

	async save(cookies: SessionCookies): Promise<void> {
		this.saves += 1;
		this.data = cookies;
	}

	async clear(): Promise<void> {
		this.clears += 1;
		this.data = null;
	}
}

/**
 * Builds a real SessionMachine over stubbed fetch with a stored session and
 * registers it as the data layer's machine, so service calls run through the
 * exact production path (cookies in, Set-Cookie captured, 401 refresh).
 * Returns the machine and the fetch mock for call assertions.
 */
export function makeRegisteredMachine(
	handlers: Record<string, FetchHandler>,
	store: MemoryStore = new MemoryStore(),
): { machine: SessionMachine; fetchMock: ReturnType<typeof vi.fn> } {
	const fetchMock = stubFetchRouter(handlers);
	vi.stubGlobal("fetch", fetchMock);
	store.data = { accessToken: ACCESS, refreshToken: REFRESH };
	const auth = new AuthSession(new CookieJar(store), API_BASE);
	const machine = new SessionMachine(auth);
	resetSessionRuntime();
	registerSessionMachine(machine);
	return { machine, fetchMock };
}

afterEach(() => {
	vi.unstubAllGlobals();
	resetSessionRuntime();
});
