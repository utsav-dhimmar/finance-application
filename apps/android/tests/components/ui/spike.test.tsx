import { render } from "@testing-library/react-native";
import { describe, expect, it } from "vitest";

// Spike (tasks.md 1.1) — structural smoke tests over the REAL @expo/ui
// components under the vitest-native engine, plus the recorded findings that
// shape the migration's test strategy (src/components/ui/SPIKE-NOTES.md).
//
// Findings:
// 1. The engine needs the "ExpoUI" native-module stub from tests/setup.ts
//    (Material palette generation + control constants); both mock layers
//    (TurboModuleRegistry and globalThis.expo.modules) are patched because
//    expo-modules-core consults globalThis.expo.modules first, and the SDK
//    58 table's ExpoUI entry is stale.
// 2. Real components mount as ViewManagerAdapter_ExpoUI_* host views and
//    children nest correctly, but Compose content is serialized into props
//    (TextView carries `text`, TextFieldView carries `placeholder`) instead
//    of rendering RN Text nodes — RNTL content/interaction queries (getByText,
//    fireEvent.press on text, getByPlaceholderText) cannot reach Compose
//    content, and raw string children throw the RN Text invariant.
// 3. Therefore interaction tests in this repo target the boxy wrapper
//    components through typed @expo/ui test doubles (see tests/helpers/ui),
//    while these smoke tests keep the real components mounted so a broken
//    @expo/ui upgrade surfaces here first. Real rendering/interaction is
//    device-verified in Expo Go (tasks.md 4.3).

import {
	Button,
	DropdownMenu,
	DropdownMenuItem,
	Host,
	LazyColumn,
	ModalBottomSheet,
	TextField,
	Text,
} from "@expo/ui/jetpack-compose";
import { View } from "react-native";

type TestRenderResult = Awaited<ReturnType<typeof render>>;
type TestInstance = NonNullable<TestRenderResult["root"]>;

/** The rendered tree root; null only when nothing rendered. */
function rootOf(view: TestRenderResult): TestInstance {
	const root = view.root;
	if (!root) {
		throw new Error("nothing rendered");
	}
	return root;
}

/** Every element in the rendered tree carrying a given prop value. */
function elementsWithProps(
	root: TestInstance,
	props: Record<string, unknown>,
): TestInstance[] {
	const entries = Object.entries(props);
	const matches: TestInstance[] = [];
	const visit = (node: TestInstance) => {
		if (entries.every(([key, value]) => node.props[key] === value)) {
			matches.push(node);
		}
		for (const child of node.children) {
			if (child && typeof child === "object") {
				visit(child as TestInstance);
			}
		}
	};
	visit(root);
	return matches;
}

describe("expo-ui spike (structural, real components)", () => {
	it("mounts Host + Button with the label serialized as a text prop", async () => {
		const view = await render(
			<Host>
				<Button>
					<Text>Sign out</Text>
				</Button>
			</Host>,
		);
		expect(elementsWithProps(rootOf(view), { text: "Sign out" })).toHaveLength(
			1,
		);
	});

	it("mounts TextField with the placeholder slot", async () => {
		const view = await render(
			<Host>
				<TextField>
					<TextField.Placeholder>
						<Text>Email address</Text>
					</TextField.Placeholder>
				</TextField>
			</Host>,
		);
		expect(
			elementsWithProps(rootOf(view), { text: "Email address" }),
		).toHaveLength(1);
	});

	it("mounts DropdownMenu with trigger and item children", async () => {
		const view = await render(
			<Host>
				<DropdownMenu expanded onDismissRequest={() => undefined}>
					<DropdownMenu.Trigger>
						<Text>Choose account type</Text>
					</DropdownMenu.Trigger>
					<DropdownMenu.Items>
						<DropdownMenuItem onClick={() => undefined}>
							<DropdownMenuItem.Text>
								<Text>Bank</Text>
							</DropdownMenuItem.Text>
						</DropdownMenuItem>
					</DropdownMenu.Items>
				</DropdownMenu>
			</Host>,
		);
		expect(elementsWithProps(rootOf(view), { expanded: true })).toHaveLength(1);
	});

	it("mounts ModalBottomSheet with content nested inside", async () => {
		const view = await render(
			<Host>
				<ModalBottomSheet onDismissRequest={() => undefined}>
					<Text>Sheet body content</Text>
				</ModalBottomSheet>
			</Host>,
		);
		expect(
			elementsWithProps(rootOf(view), { text: "Sheet body content" }),
		).toHaveLength(1);
	});

	it("mounts LazyColumn with pooled item slots", async () => {
		const items = ["Alpha", "Beta"];
		const view = await render(
			<Host style={{ flex: 1 }}>
				<LazyColumn>
					<LazyColumn.Items data={items} keyExtractor={(item) => item}>
						{({ item }: { item: string }) => (
							<View key={item}>
								<Text>{item}</Text>
							</View>
						)}
					</LazyColumn.Items>
				</LazyColumn>
			</Host>,
		);
		// Items render through the recycling pool; the item text reaches the
		// TextView adapters.
		expect(elementsWithProps(rootOf(view), { text: "Alpha" })).toHaveLength(1);
		expect(elementsWithProps(rootOf(view), { text: "Beta" })).toHaveLength(1);
	});
});
