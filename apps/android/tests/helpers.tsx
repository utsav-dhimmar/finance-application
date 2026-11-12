import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { expect } from "vitest";

// Creates a QueryClient tuned for tests: no retries so failures surface
// immediately, mirroring the web test helpers.
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
}

/** Wraps a component with the providers data-layer hooks and screens need. */
export function withProviders(
	ui: ReactElement,
	queryClient: QueryClient = createTestQueryClient(),
): { element: ReactElement; queryClient: QueryClient } {
	return {
		element: (
			<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
		),
		queryClient,
	};
}

/** Renders a component under the provider stack, like the web's renderRoute. */
export async function renderWithProviders(
	ui: ReactElement,
	queryClient: QueryClient = createTestQueryClient(),
) {
	const { element, queryClient: client } = withProviders(ui, queryClient);
	// RNTL 14 render is async and must be awaited.
	const view = await render(element);
	return { view, queryClient: client };
}

/** Provider stack for renderHook: pass it as the renderHook wrapper. */
export function HookWrapper({
	children,
	queryClient,
}: {
	children: ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

type TestRenderResult = Awaited<ReturnType<typeof render>>;
type TestInstance = NonNullable<TestRenderResult["root"]>;

/**
 * Presses a native dropdown's option.
 *
 * The native dropdown's options mount inline under the test doubles (the
 * popup itself is native and device-verified in Expo Go). The LAST text
 * match is the option — the field's trigger shows the same label when the
 * option is already selected, the trigger renders before the items, and
 * dialogs render after the screen behind them. Mirrors the
 * accessibility-label last-match convention this suite used with the
 * previous modal-sheet select.
 *
 * Pass `fieldLabel` when several dropdowns on one surface share option
 * pools (e.g. a transfer's source and destination): only the matches inside
 * the labeled field's subtree count.
 */
export async function pickOption(
	view: TestRenderResult,
	optionLabel: string,
	fieldLabel?: string,
): Promise<void> {
	// Options come from server data (accounts, categories) and may load
	// after the field renders; wait for the option, then press the last
	// match.
	await waitFor(
		() =>
			expect(
				optionMatches(view, optionLabel, fieldLabel).length,
			).toBeGreaterThan(0),
		{ timeout: 10_000 },
	);
	const matches = optionMatches(view, optionLabel, fieldLabel);
	const option = matches[matches.length - 1];
	if (!option) {
		throw new Error(`Option not found: ${optionLabel}`);
	}
	// fireEvent.press bubbles from the option's text to its pressable row.
	await fireEvent.press(option);
}

function optionMatches(
	view: TestRenderResult,
	optionLabel: string,
	fieldLabel: string | undefined,
): TestInstance[] {
	if (!fieldLabel) {
		return view.getAllByText(optionLabel);
	}
	// The field's boxy label is rendered as plain text right above its
	// native dropdown: ascend from the label to the lowest ancestor whose
	// subtree contains the option — the field's own container, which keeps
	// sibling fields' options out of scope.
	const root = view.root;
	if (!root) {
		return [];
	}
	for (const labelNode of exactTextNodes(root, fieldLabel)) {
		let container = labelNode.parent;
		while (container) {
			const matches = exactTextNodes(container, optionLabel);
			if (matches.length > 0) {
				return matches;
			}
			container = container.parent;
		}
	}
	return [];
}

function exactTextNodes(node: TestInstance, text: string): TestInstance[] {
	const found: TestInstance[] = [];
	const visit = (candidate: TestInstance): void => {
		if (candidate.children.length === 1 && candidate.children[0] === text) {
			found.push(candidate);
		}
		for (const child of candidate.children) {
			if (child && typeof child === "object") {
				visit(child as TestInstance);
			}
		}
	};
	visit(node);
	return found;
}
