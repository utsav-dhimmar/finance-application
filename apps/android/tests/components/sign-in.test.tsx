import { loginBodySchema } from "@finance-application/schemas";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The fields and submit are native @expo/ui components now; run them
// against the typed test doubles (design.md D9 — see
// src/components/ui/SPIKE-NOTES.md).
vi.mock(
	"@expo/ui/jetpack-compose",
	async () => await import("@tests/helpers/ui-doubles"),
);

// The screen consumes the session context; tests replace it so no secure
// store or network is touched. vi.hoisted keeps the mock above hoisting.
const { signInMock } = vi.hoisted(() => ({
	signInMock: vi.fn((_email: string, _password: string) => Promise.resolve()),
}));
vi.mock("@/session/session-context", () => ({
	useSession: () => ({
		state: { status: "signed-out" } as const,
		signIn: signInMock,
	}),
}));

import SignIn from "@/app/(auth)/sign-in";

function schemaMessage(values: Record<string, string>): string {
	const result = loginBodySchema.safeParse(values);
	expect(result.success).toBe(false);
	return result.error?.issues[0]?.message ?? "";
}

describe("SignIn", () => {
	beforeEach(() => {
		signInMock.mockClear();
	});

	it("renders the screen with brand, fields, and submit", async () => {
		const view = await render(<SignIn />);
		expect(view.getByText("Finance")).toBeOnTheScreen();
		expect(view.getByLabelText("Email")).toBeOnTheScreen();
		expect(view.getByLabelText("Password")).toBeOnTheScreen();
		expect(view.getByRole("button", { name: "Sign in" })).toBeOnTheScreen();
	});

	it("keeps submit disabled while fields are empty", async () => {
		const view = await render(<SignIn />);
		expect(
			view.getByRole("button", { name: "Sign in" }).props.accessibilityState
				?.disabled,
		).toBe(true);
	});

	it("blocks submission for an invalid email and shows the schema message", async () => {
		const view = await render(<SignIn />);
		await fireEvent.changeText(view.getByLabelText("Email"), "not-an-email");
		await fireEvent.changeText(view.getByLabelText("Password"), "longenough1");
		await fireEvent.press(view.getByRole("button", { name: "Sign in" }));

		await waitFor(
			() =>
				expect(
					view.getByText(
						schemaMessage({ email: "not-an-email", password: "longenough1" }),
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(signInMock).not.toHaveBeenCalled();
	});

	it("blocks submission for a too-short password and shows the schema message", async () => {
		const view = await render(<SignIn />);
		await fireEvent.changeText(
			view.getByLabelText("Email"),
			"user@example.com",
		);
		await fireEvent.changeText(view.getByLabelText("Password"), "short");
		await fireEvent.press(view.getByRole("button", { name: "Sign in" }));

		await waitFor(
			() =>
				expect(
					view.getByText(
						schemaMessage({ email: "user@example.com", password: "short" }),
					),
				).toBeOnTheScreen(),
			{ timeout: 10_000 },
		);
		expect(signInMock).not.toHaveBeenCalled();
	});

	it("submits the parsed payload on valid values", async () => {
		const view = await render(<SignIn />);
		await fireEvent.changeText(
			view.getByLabelText("Email"),
			"User@Example.com",
		);
		await fireEvent.changeText(view.getByLabelText("Password"), "longenough1");
		await fireEvent.press(view.getByRole("button", { name: "Sign in" }));

		await waitFor(() => expect(signInMock).toHaveBeenCalled(), {
			timeout: 10_000,
		});
		// Parsed output: the schema lowercases the email.
		expect(signInMock).toHaveBeenCalledWith("user@example.com", "longenough1");
	});
});
