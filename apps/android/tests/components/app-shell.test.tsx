import { render } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

import AppLayout from "@/app/(app)/_layout";

// The shell mounts the real navigator; the session context is mocked so no
// secure store or network is involved (per the repo's testing rules).
const sessionMock = vi.hoisted(() => ({
	useSession: () => ({
		state: {
			status: "signed-in" as const,
			user: { id: "user-1", email: "user@example.com" },
		},
		signIn: vi.fn(),
		signOut: vi.fn(),
	}),
}));

vi.mock("@/session/session-context", () => sessionMock);

// The native tab bar module is mocked here: standalone rendering has no
// router file context and no native tab module under the Node-only engine.
// The fake renders its triggers' labels, so this file verifies the shell's
// real wiring — header above the tab bar and the four destinations with
// their titles — while the bar's native behavior is device-verified in the
// QA checklist.
vi.mock("expo-router/native-tabs", async () => {
	const { createElement } = await import("react");
	const { Text, View } = await import("react-native");
	const Trigger = ({ children }: { children: React.ReactNode }) =>
		createElement(View, null, children);
	Trigger.Label = ({ children }: { children: React.ReactNode }) =>
		createElement(Text, null, children);
	Trigger.Icon = () => null;
	const NativeTabs = ({ children }: { children: React.ReactNode }) =>
		createElement(View, null, children);
	NativeTabs.Trigger = Trigger;
	return { NativeTabs };
});

describe("AppLayout authenticated shell", () => {
	it("shows the session header above the native tab bar", async () => {
		const view = await render(<AppLayout />);
		expect(view.getByText("Finance")).toBeOnTheScreen();
		expect(view.getByText("user@example.com")).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
	});

	it("declares the four tab destinations by title", async () => {
		const view = await render(<AppLayout />);
		for (const title of ["Dashboard", "Transactions", "Accounts", "Categories"]) {
			expect(view.getByText(title)).toBeOnTheScreen();
		}
	});
});
