import {
	Children as ReactChildren,
	isValidElement,
	useRef,
	useState,
} from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
	ActivityIndicator,
	Pressable,
	Text as RNText,
	TextInput,
	View,
} from "react-native";

// Test doubles for `@expo/ui/jetpack-compose` (design.md D9 spike outcome).
// They mirror each primitive's CONTRACT — children content, onClick /
// onValueChange callbacks, `enabled`, observable `value`, controlled
// `expanded`, conditional mount — rendered with plain React Native
// primitives so React Native Testing Library queries reach them. The real
// Compose components serialize content into native-view props, which RNTL
// cannot see (see src/components/ui/SPIKE-NOTES.md). Rendering, gestures,
// and TalkBack behavior of the real components are device-verified in Expo
// Go (tasks.md 4.3).
//
// Doubles deliberately do NOT fabricate accessibility roles or labels the
// real components lack: queries in migrated tests target text content and
// props that exist on both.

export function Host({
	children,
	style,
}: {
	children?: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	return <View style={style}>{children}</View>;
}

export function Text({
	children,
	color,
	style,
	...rest
}: {
	children?: React.ReactNode;
	color?: string;
	style?: { fontSize?: number; fontWeight?: string } | undefined;
} & Record<string, unknown>) {
	const { fontWeight, fontSize, ...styleRest } = style ?? {};
	return (
		<RNText
			{...rest}
			style={{
				color,
				fontSize,
				fontWeight: fontWeight as "400" | "500" | "700" | undefined,
				...styleRest,
			}}
		>
			{children}
		</RNText>
	);
}

function ButtonDouble({
	onClick,
	enabled = true,
	children,
}: {
	onClick?: () => void;
	enabled?: boolean;
	children?: React.ReactNode;
}) {
	// accessibilityRole="button" mirrors the real Compose button's native
	// Role.Button semantics that TalkBack reads on device.
	return (
		<Pressable accessibilityRole="button" disabled={!enabled} onPress={onClick}>
			{children}
		</Pressable>
	);
}

export const Button = ButtonDouble;
export const FilledTonalButton = ButtonDouble;
export const ElevatedButton = ButtonDouble;
export const OutlinedButton = ButtonDouble;
export const TextButton = ButtonDouble;

/** Minimal ObservableState with the same get/set/value contract. */
export function useNativeState<T>(initialValue: T) {
	const [value, setValue] = useState(initialValue);
	const ref = useRef(value);
	ref.current = value;
	const state = useRef<{
		value: T;
		get: () => T;
		set: (next: T) => void;
	} | null>(null);
	if (state.current === null) {
		state.current = {
			get value() {
				return ref.current;
			},
			set value(next: T) {
				setValue(next);
			},
			get: () => ref.current,
			set: (next: T) => {
				ref.current = next;
				setValue(next);
			},
		};
	}
	return state.current;
}

function TextFieldDouble({
	value,
	onValueChange,
	enabled = true,
	singleLine,
	visualTransformation,
	children,
}: {
	value?: { value: string; set: (next: string) => void };
	onValueChange?: (value: string) => void;
	enabled?: boolean;
	singleLine?: boolean;
	visualTransformation?: "password" | "none";
	children?: React.ReactNode;
}) {
	const fallback = useNativeState("");
	const observable = value ?? fallback;
	// The real field shows its Placeholder slot's text when empty; surface it
	// as the double input's placeholder so tests target the same concept
	// with getByPlaceholderText. The Label slot is the field's accessible
	// name on device (TalkBack merges Compose label semantics), so the
	// double maps it to the input's accessibilityLabel.
	let placeholder: string | undefined;
	let label: string | undefined;
	for (const child of ReactChildren.toArray(children)) {
		if (isValidElement(child) && child.type === PlaceholderSlot) {
			placeholder = slotText((child.props as { children?: unknown }).children);
		}
		if (isValidElement(child) && child.type === LabelSlot) {
			label = slotText((child.props as { children?: unknown }).children);
		}
	}
	return (
		<View>
			{children}
			<TextInput
				accessibilityLabel={label}
				editable={enabled}
				multiline={singleLine !== true}
				onChangeText={(text) => {
					observable.set(text);
					onValueChange?.(text);
				}}
				placeholder={placeholder}
				secureTextEntry={visualTransformation === "password"}
				value={observable.value}
			/>
		</View>
	);
}

export const TextField = TextFieldDouble;
export const OutlinedTextField = TextFieldDouble;
export const BasicTextField = TextFieldDouble;

// Decoration slots render inline; queries target their text content. Named
// components give the double TextField its slot identity back.
function SlotDouble({ children }: { children?: React.ReactNode }) {
	return <>{children}</>;
}

function PlaceholderSlot({ children }: { children?: React.ReactNode }) {
	return <>{children}</>;
}

function LabelSlot({ children }: { children?: React.ReactNode }) {
	return <>{children}</>;
}

/** Deep-reads a slot's text content (strings through Text doubles). */
function slotText(node: unknown): string | undefined {
	if (typeof node === "string") {
		return node;
	}
	if (typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		for (const item of node) {
			const found = slotText(item);
			if (found !== undefined) {
				return found;
			}
		}
		return undefined;
	}
	if (typeof node === "object" && node !== null && "props" in node) {
		return slotText((node as { props: { children?: unknown } }).props.children);
	}
	return undefined;
}

export const TextFieldSlots = {
	Label: LabelSlot,
	Placeholder: PlaceholderSlot,
	LeadingIcon: SlotDouble,
	TrailingIcon: SlotDouble,
	Prefix: SlotDouble,
	Suffix: SlotDouble,
	SupportingText: SlotDouble,
};

// Attach the slots to the field components (the real API namespaces them).
for (const component of [TextField, OutlinedTextField, BasicTextField]) {
	Object.assign(component, TextFieldSlots);
}

export function DropdownMenu({
	children,
	expanded,
	onDismissRequest,
}: {
	children?: React.ReactNode;
	expanded?: boolean;
	onDismissRequest?: () => void;
}) {
	// The native menu opens its popup from the trigger press and reports
	// dismissal through onDismissRequest; the JS tree mounts the trigger and
	// items regardless, which is exactly what the double renders inline.
	void expanded;
	void onDismissRequest;
	return <View>{children}</View>;
}

Object.assign(DropdownMenu, {
	Trigger: SlotDouble,
	Preview: SlotDouble,
	Items: SlotDouble,
});

export function DropdownMenuItem({
	onClick,
	enabled = true,
	children,
}: {
	onClick?: () => void;
	enabled?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<Pressable accessibilityRole="button" disabled={!enabled} onPress={onClick}>
			{children}
		</Pressable>
	);
}

Object.assign(DropdownMenuItem, {
	Text: SlotDouble,
	LeadingIcon: SlotDouble,
	TrailingIcon: SlotDouble,
});

export const SelectableDropdownMenuItem = DropdownMenuItem;

export function AlertDialog({
	children,
	onDismissRequest,
}: {
	children?: React.ReactNode;
	onDismissRequest?: () => void;
}) {
	void onDismissRequest;
	return <View>{children}</View>;
}

Object.assign(AlertDialog, {
	Title: SlotDouble,
	Text: SlotDouble,
	ConfirmButton: SlotDouble,
	DismissButton: SlotDouble,
	Icon: SlotDouble,
});

export function ModalBottomSheet({
	children,
	onDismissRequest,
}: {
	children?: React.ReactNode;
	onDismissRequest?: () => void;
}) {
	void onDismissRequest;
	return <View>{children}</View>;
}

Object.assign(ModalBottomSheet, {
	DragHandle: SlotDouble,
});

export function DatePickerDialog({
	initialDate,
	onDateSelected,
	onDismissRequest,
	confirmButtonLabel = "Confirm",
	dismissButtonLabel = "Dismiss",
}: {
	initialDate?: string | null;
	onDateSelected?: (date: Date) => void;
	onDismissRequest?: () => void;
	confirmButtonLabel?: string;
	dismissButtonLabel?: string;
}) {
	// The real dialog presents its own confirm/dismiss buttons natively; the
	// double exposes them as pressables so tests drive the same callbacks.
	return (
		<View>
			<RNText>{initialDate ?? "Pick a date"}</RNText>
			<Pressable
				onPress={() => {
					onDateSelected?.(initialDate ? new Date(initialDate) : new Date());
				}}
			>
				<RNText>{confirmButtonLabel}</RNText>
			</Pressable>
			<Pressable onPress={onDismissRequest}>
				<RNText>{dismissButtonLabel}</RNText>
			</Pressable>
		</View>
	);
}

export function LazyColumn({ children }: { children?: React.ReactNode }) {
	return <View>{children}</View>;
}

Object.assign(LazyColumn, {
	Items: function LazyItemsDouble<T>({
		data,
		children,
	}: {
		data: readonly T[];
		children: (info: { item: T; index: number }) => React.ReactNode;
	}) {
		return <>{data.map((item, index) => children({ item, index }))}</>;
	},
});

export function LazyRow({ children }: { children?: React.ReactNode }) {
	return <View>{children}</View>;
}

export function PullToRefreshBox({
	children,
	isRefreshing,
	onRefresh,
}: {
	children?: React.ReactNode;
	isRefreshing?: boolean;
	onRefresh?: () => void;
}) {
	// The native gesture is device-verified; the double just renders content.
	void isRefreshing;
	void onRefresh;
	return <View>{children}</View>;
}

export function Column({ children }: { children?: React.ReactNode }) {
	return <View>{children}</View>;
}

export function Row({ children }: { children?: React.ReactNode }) {
	return <View>{children}</View>;
}

export function LoadingIndicator({ color }: { color?: string }) {
	return <ActivityIndicator color={color} />;
}

export function SegmentedButton({
	children,
	onClick,
	selected,
	enabled = true,
}: {
	children?: React.ReactNode;
	onClick?: () => void;
	selected?: boolean;
	enabled?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: !!selected }}
			disabled={!enabled}
			onPress={onClick}
		>
			{children}
		</Pressable>
	);
}

export function SingleChoiceSegmentedButtonRow({
	children,
}: {
	children?: React.ReactNode;
}) {
	return <View>{children}</View>;
}

export function MultiChoiceSegmentedButtonRow({
	children,
}: {
	children?: React.ReactNode;
}) {
	return <View>{children}</View>;
}

// Modifier factories and shapes are visual-only; the doubles ignore them.
export const Shape = {
	Rectangle: function ShapeRectangle() {
		return null;
	},
	Circle: function ShapeCircle() {
		return null;
	},
	RoundedCorner: function ShapeRoundedCorner() {
		return null;
	},
	Pill: function ShapePill() {
		return null;
	},
};

export const modifiers = {
	paddingAll: () => ({}),
	padding: () => ({}),
	fillMaxSize: () => ({}),
	fillMaxWidth: () => ({}),
	fillMaxHeight: () => ({}),
	size: () => ({}),
	background: () => ({}),
	border: () => ({}),
	cornerRadius: () => ({}),
};

export function NavigationBar({ children }: { children?: React.ReactNode }) {
	return <View>{children}</View>;
}

Object.assign(NavigationBar, {
	Item: function NavigationBarItemDouble({
		children,
		onClick,
		selected,
	}: {
		children?: React.ReactNode;
		onClick?: () => void;
		selected?: boolean;
	}) {
		return (
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ selected: !!selected }}
				onPress={onClick}
			>
				{children}
			</Pressable>
		);
	},
});

export function TopAppBar({ children }: { children?: React.ReactNode }) {
	return <View>{children}</View>;
}
