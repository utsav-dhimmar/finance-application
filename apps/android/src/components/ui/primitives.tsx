import { useEffect } from "react";
import {
	Button,
	Column,
	DropdownMenu,
	DropdownMenuItem,
	OutlinedButton,
	OutlinedTextField,
	Row,
	TextButton,
	TextField,
	Text as ComposeText,
	useNativeState,
} from "@expo/ui/jetpack-compose";
import { ActivityIndicator } from "react-native";
import { spacing, type ThemeColors } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";
import {
	boxyShape,
	composeText,
	destructiveButtonColors,
	fieldColors,
	ghostButtonColors,
	outlineButtonColors,
	outlineDestructiveButtonColors,
	primaryButtonColors,
	type BoxyTextVariant,
} from "@/components/ui/theme-mapping";

/**
 * Compose-side building blocks WITHOUT a `Host`: the public wrappers in
 * `index.tsx` each own exactly one `Host` (a native `Host` per nested wrapper
 * is forbidden — @expo/ui warns on nested hosts), and form dialogs compose
 * these cores inside their dialog's single host.
 */

export type BoxyButtonVariant =
	| "primary"
	| "outline"
	| "outlineDestructive"
	| "ghost"
	| "destructive";

export interface BoxyButtonCoreProps {
	label: string;
	onPress: () => void;
	variant?: BoxyButtonVariant;
	disabled?: boolean;
	/** Shows the in-flight spinner next to the label and disables the control. */
	pending?: boolean;
}

/** The button content itself; a Host-owning ancestor supplies the host. */
export function BoxyButtonCore({
	label,
	onPress,
	variant = "primary",
	disabled,
	pending,
}: BoxyButtonCoreProps) {
	const c = useThemeColors();
	const enabled = disabled !== true && pending !== true;
	const onPressProps = {
		onClick: onPress,
		enabled,
		shape: boxyShape,
	};
	if (variant === "outline") {
		return (
			<OutlinedButton {...onPressProps} colors={outlineButtonColors(c)}>
				<ButtonContent label={label} pending={!!pending} variant="outline" />
			</OutlinedButton>
		);
	}
	if (variant === "outlineDestructive") {
		return (
			<OutlinedButton
				{...onPressProps}
				colors={outlineDestructiveButtonColors(c)}
			>
				<ButtonContent
					label={label}
					pending={!!pending}
					variant="outlineDestructive"
				/>
			</OutlinedButton>
		);
	}
	if (variant === "ghost") {
		return (
			<TextButton {...onPressProps} colors={ghostButtonColors(c)}>
				<ButtonContent label={label} pending={!!pending} variant="ghost" />
			</TextButton>
		);
	}
	const colors =
		variant === "destructive"
			? destructiveButtonColors(c)
			: primaryButtonColors(c);
	return (
		<Button {...onPressProps} colors={colors}>
			<ButtonContent label={label} pending={!!pending} variant={variant} />
		</Button>
	);
}

/** Label text plus the in-flight spinner, tinted with the variant's content color. */
function ButtonContent({
	label,
	pending,
	variant,
}: {
	label: string;
	pending: boolean;
	variant: BoxyButtonVariant;
}) {
	const c = useThemeColors();
	const contentColor = pending
		? (contentColorFor(c, variant) ?? c.foreground)
		: undefined;
	return (
		<>
			<ComposeText color={contentColor}>{label}</ComposeText>
			{pending && <ActivityIndicator color={contentColor} />}
		</>
	);
}

function contentColorFor(c: ThemeColors, variant: BoxyButtonVariant): string {
	switch (variant) {
		case "primary":
			return c.primaryForeground;
		case "destructive":
			return c.destructiveForeground;
		case "outline":
		case "ghost":
			return c.foreground;
		case "outlineDestructive":
			return c.destructive;
	}
}

export interface BoxyTextFieldCoreProps {
	value: string;
	onChangeText: (value: string) => void;
	placeholder?: string;
	/**
	 * The field's accessible name, rendered as the Compose label slot —
	 * on device TalkBack merges it into the field's semantics, and the
	 * test double maps it to the input's accessibilityLabel.
	 */
	label?: string;
	secure?: boolean;
	keyboardType?: "default" | "email" | "number" | "decimal";
	multiline?: boolean;
	disabled?: boolean;
	/** Error text rendered as the field's supporting text in the destructive color. */
	error?: string | null;
}

/**
 * A text field bound to React state: the Compose side owns an observable
 * value (the native way to bind text), the React side keeps its own state
 * through `onChangeText`, and an effect re-syncs external value changes
 * (form resets) into the observable.
 */
export function BoxyTextFieldCore({
	value,
	onChangeText,
	placeholder,
	label,
	secure,
	keyboardType = "default",
	multiline,
	disabled,
	error,
}: BoxyTextFieldCoreProps) {
	const c = useThemeColors();
	const valueState = useNativeState(value);
	useEffect(() => {
		valueState.set(value);
	}, [valueState, value]);
	return (
		<OutlinedTextField
			value={valueState}
			onValueChange={onChangeText}
			enabled={disabled !== true}
			isError={!!error}
			singleLine={multiline !== true}
			visualTransformation={secure ? "password" : "none"}
			keyboardOptions={{
				keyboardType: keyboardType === "default" ? "text" : keyboardType,
			}}
			shape={boxyShape}
			colors={fieldColors(c)}
		>
			{label && (
				<TextField.Label>
					<ComposeText color={c.mutedForeground}>{label}</ComposeText>
				</TextField.Label>
			)}
			{placeholder && (
				<TextField.Placeholder>
					<ComposeText color={c.mutedForeground}>{placeholder}</ComposeText>
				</TextField.Placeholder>
			)}
			{error && (
				<TextField.SupportingText>
					<ComposeText color={c.destructive}>{error}</ComposeText>
				</TextField.SupportingText>
			)}
		</OutlinedTextField>
	);
}

export interface SelectOption {
	value: string;
	label: string;
}

export interface BoxySelectMenuCoreProps {
	options: SelectOption[];
	value: string;
	placeholder?: string;
	onValueChange: (value: string) => void;
}

/**
 * A native dropdown select: a trigger showing the selected label opens a
 * Compose dropdown menu of options. The menu is uncontrolled on the JS side —
 * the native layer opens it from the trigger press and reports dismissal
 * through `onDismissRequest` — so no open state is kept here.
 */
export function BoxySelectMenuCore({
	options,
	value,
	placeholder = "Select",
	onValueChange,
}: BoxySelectMenuCoreProps) {
	const c = useThemeColors();
	const selected = options.find((option) => option.value === value);
	return (
		<DropdownMenu cornerRadius={0} onDismissRequest={() => undefined}>
			<DropdownMenu.Trigger>
				<ComposeText color={selected ? c.foreground : c.mutedForeground}>
					{selected ? selected.label : placeholder}
				</ComposeText>
			</DropdownMenu.Trigger>
			<DropdownMenu.Items>
				{options.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onClick={() => {
							onValueChange(option.value);
						}}
					>
						<DropdownMenuItem.Text>
							<ComposeText color={c.foreground}>{option.label}</ComposeText>
						</DropdownMenuItem.Text>
					</DropdownMenuItem>
				))}
			</DropdownMenu.Items>
		</DropdownMenu>
	);
}

/** Static copy on native surfaces, sized from the shared typography tokens. */
export function BoxyText({
	variant,
	foreground,
	children,
}: {
	variant: BoxyTextVariant;
	foreground?: string;
	children: React.ReactNode;
}) {
	const c = useThemeColors();
	const t = composeText(foreground ?? c.foreground, variant);
	return (
		<ComposeText
			color={t.color}
			style={{ fontSize: t.fontSize, fontWeight: t.fontWeight }}
		>
			{children}
		</ComposeText>
	);
}

/** Vertical stack inside a native surface, spaced by the shared tokens. */
export function BoxyColumn({
	gap,
	children,
}: {
	gap?: number;
	children: React.ReactNode;
}) {
	return (
		<Column
			verticalArrangement={gap ? { spacedBy: gap } : "top"}
			horizontalAlignment="start"
		>
			{children}
		</Column>
	);
}

/** Horizontal row inside a native surface, spaced by the shared tokens. */
export function BoxyRow({
	gap,
	children,
}: {
	gap?: number;
	children: React.ReactNode;
}) {
	return (
		<Row
			horizontalArrangement={gap ? { spacedBy: gap } : "start"}
			verticalAlignment="top"
		>
			{children}
		</Row>
	);
}

/**
 * A labeled form field inside a native surface: the boxy label above the
 * control, then the field error (destructive) or helper (muted) line.
 */
export function BoxyFormField({
	label,
	error,
	helper,
	children,
}: {
	label: string;
	error?: string | null;
	helper?: string | null;
	children: React.ReactNode;
}) {
	const c = useThemeColors();
	return (
		<BoxyColumn gap={spacing.xs}>
			<BoxyText variant="label" foreground={c.mutedForeground}>
				{label}
			</BoxyText>
			{children}
			{error ? (
				<BoxyText variant="caption" foreground={c.destructive}>
					{error}
				</BoxyText>
			) : null}
			{!error && helper ? (
				<BoxyText variant="caption" foreground={c.mutedForeground}>
					{helper}
				</BoxyText>
			) : null}
		</BoxyColumn>
	);
}
