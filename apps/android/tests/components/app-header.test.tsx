import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The sign-out control is a native @expo/ui button now; run it against the
// typed test doubles (design.md D9 — see src/components/ui/SPIKE-NOTES.md).
vi.mock(
	"@expo/ui/jetpack-compose",
	async () => await import("@tests/helpers/ui-doubles"),
);

// The header consumes the session context; tests replace it so no secure
// store or network is touched. vi.hoisted keeps the mock above hoisting.
const { signOutMock } = vi.hoisted(() => ({
	signOutMock: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/session/session-context", () => ({
	useSession: () => ({
		state: {
			status: "signed-in",
			user: { id: "user-1", email: "user@example.com" },
		},
		signIn: vi.fn(() => Promise.resolve()),
		signOut: signOutMock,
	}),
}));

// The Transactions placeholder file now hosts the real activity screen, whose
// data-layer imports reach sonner-native (reanimated easings) — mock it so
// the header/placeholder test stays native-module free.
vi.mock("sonner-native", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import { AppHeader } from "@/components/app-header";

describe("AppHeader", () => {
	beforeEach(() => {
		signOutMock.mockClear();
	});

	it("shows the signed-in user's email", async () => {
		const view = await render(<AppHeader />);
		expect(view.getByText("user@example.com")).toBeOnTheScreen();
	});

	it("shows the brand and the sign-out control", async () => {
		const view = await render(<AppHeader />);
		expect(view.getByText("Finance")).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
	});

	it("signs out when the sign-out control is activated", async () => {
		const view = await render(<AppHeader />);
		await fireEvent.press(view.getByRole("button", { name: "Sign out" }));
		await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
	});
});

// The last placeholder (the Dashboard tab) was replaced by the real
// dashboard screen, so no tab renders the "not available yet" notice
// anymore; the shell's pending-notice scenario simply never fires.
