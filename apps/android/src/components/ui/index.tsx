import {
	AlertDialog,
	DatePickerDialog,
	Host,
	LazyColumn,
	LoadingIndicator,
	ModalBottomSheet,
	NavigationBar,
	PullToRefreshBox,
	NavigationBarItem,
	SegmentedButton,
	SingleChoiceSegmentedButtonRow,
	Text as ComposeText,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import { calendarDateString } from "@/lib/calendar-date";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";
import {
	BoxyButtonCore,
	BoxySelectMenuCore,
	BoxyText,
	BoxyTextFieldCore,
	type BoxyButtonCoreProps,
	type BoxySelectMenuCoreProps,
	type BoxyTextFieldCoreProps,
	type SelectOption,
} from "@/components/ui/primitives";

export {
	BoxyButtonCore,
	BoxyColumn,
	BoxyFormField,
	BoxyRow,
	BoxySelectMenuCore,
	BoxyTextFieldCore,
	BoxyText,
} from "@/components/ui/primitives";
export type {
	BoxyButtonCoreProps,
	BoxyButtonVariant,
	BoxySelectMenuCoreProps,
	BoxyTextFieldCoreProps,
	SelectOption,
} from "@/components/ui/primitives";

// The public wrappers: each owns exactly ONE `Host` so screens can use them
// directly without nesting hosts (forbidden by @expo/ui), while dialogs that
// need several controls compose the Host-less cores inside their dialog's
// own single host.

export function BoxyButton(props: BoxyButtonCoreProps) {
	return (
		<Host>
			<BoxyButtonCore {...props} />
		</Host>
	);
}

export interface BoxyTextFieldProps extends BoxyTextFieldCoreProps {
	/** Uppercase boxy label rendered above the native field. */
	label?: string;
}

export function BoxyTextField({ label, ...core }: BoxyTextFieldProps) {
	return (
		<Host style={stylesHostStretch}>
			<BoxyTextFieldCore {...core} label={label} />
		</Host>
	);
}

export interface BoxyDropdownFieldProps extends BoxySelectMenuCoreProps {
	/** Uppercase boxy label rendered above the native menu trigger. */
	label: string;
}

export function BoxyDropdownField({ label, ...core }: BoxyDropdownFieldProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<View style={styles.field}>
			<RNText style={styles.fieldLabel}>{label}</RNText>
			<View style={[styles.selectControl, hairline(c.border)]}>
				<Host style={stylesHostStretch}>
					<BoxySelectMenuCore {...core} />
				</Host>
			</View>
		</View>
	);
}

export interface BoxySegmentedRowProps {
	options: SelectOption[];
	value: string;
	onValueChange: (value: string) => void;
}

/** Single-choice segmented control for status tabs and period modes. */
export function BoxySegmentedRow({
	options,
	value,
	onValueChange,
}: BoxySegmentedRowProps) {
	const c = useThemeColors();
	return (
		<Host style={stylesHostStretch}>
			<SingleChoiceSegmentedButtonRow>
				{options.map((option) => (
					<SegmentedButton
						key={option.value}
						selected={value === option.value}
						onClick={() => {
							onValueChange(option.value);
						}}
						colors={{
							activeContainerColor: c.primary,
							activeContentColor: c.primaryForeground,
							activeBorderColor: c.primary,
							inactiveContentColor: c.foreground,
							inactiveBorderColor: c.border,
						}}
					>
						<ComposeText>{option.label}</ComposeText>
					</SegmentedButton>
				))}
			</SingleChoiceSegmentedButtonRow>
		</Host>
	);
}

export interface BoxyConfirmDialogProps {
	/** Conditional mount is the open/close idiom: `{open ? <BoxyConfirmDialog/> : null}`. */
	open: boolean;
	title: string;
	body?: string | null;
	confirmLabel: string;
	cancelLabel: string;
	destructive?: boolean;
	pending?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/** The native replacement for RN-Modal confirm dialogs (web-verbatim copy). */
export function BoxyConfirmDialog({
	open,
	title,
	body,
	confirmLabel,
	cancelLabel,
	destructive,
	pending,
	onConfirm,
	onCancel,
}: BoxyConfirmDialogProps) {
	const c = useThemeColors();
	if (!open) {
		return null;
	}
	return (
		<Host style={stylesHostFill}>
			<AlertDialog onDismissRequest={onCancel}>
				<AlertDialog.Title>
					<BoxyText variant="title">{title}</BoxyText>
				</AlertDialog.Title>
				{body && (
					<AlertDialog.Text>
						<BoxyText variant="body" foreground={c.mutedForeground}>
							{body}
						</BoxyText>
					</AlertDialog.Text>
				)}
				<AlertDialog.ConfirmButton>
					<BoxyButtonCore
						label={confirmLabel}
						onPress={onConfirm}
						variant={destructive ? "destructive" : "primary"}
						pending={pending}
					/>
				</AlertDialog.ConfirmButton>
				<AlertDialog.DismissButton>
					<BoxyButtonCore
						label={cancelLabel}
						onPress={onCancel}
						variant="ghost"
					/>
				</AlertDialog.DismissButton>
			</AlertDialog>
		</Host>
	);
}

export interface BoxyFormSheetProps {
	open: boolean;
	onClose: () => void;
	/** Compose-side content: BoxyColumn rows composing the Host-less cores. */
	children: ReactNode;
}

/** The native bottom-sheet surface form dialogs mount into. */
export function BoxyFormSheet({ open, onClose, children }: BoxyFormSheetProps) {
	const c = useThemeColors();
	if (!open) {
		return null;
	}
	return (
		<Host style={stylesHostFill}>
			<ModalBottomSheet
				onDismissRequest={onClose}
				containerColor={c.background}
				skipPartiallyExpanded
			>
				{children}
			</ModalBottomSheet>
		</Host>
	);
}

export interface BoxyDateFieldProps {
	label: string;
	value: string | null;
	/** Trigger label while no date is chosen. */
	placeholder?: string;
	onChange: (value: string | null) => void;
}

/**
 * A date field: a native trigger button showing the value opens the native
 * date-picker dialog, whose confirm commits the picked date as a
 * local-calendar `YYYY-MM-DD` string.
 */
export function BoxyDateField({
	label,
	value,
	placeholder,
	onChange,
}: BoxyDateFieldProps) {
	const styles = createStyles(useThemeColors());
	const [open, setOpen] = useState(false);
	return (
		<View style={styles.field}>
			<RNText style={styles.fieldLabel}>{label}</RNText>
			<BoxyButton
				label={value ?? placeholder ?? "Select date"}
				variant="outline"
				onPress={() => {
					setOpen(true);
				}}
			/>
			{open && (
				<Host style={stylesHostFill}>
					<DatePickerDialog
						initialDate={value}
						confirmButtonLabel="Done"
						dismissButtonLabel="Cancel"
						onDateSelected={(date) => {
							setOpen(false);
							onChange(calendarDateString(date));
						}}
						onDismissRequest={() => {
							setOpen(false);
						}}
					/>
				</Host>
			)}
		</View>
	);
}

export interface BoxyLazyListProps<T> {
	items: readonly T[];
	keyExtractor: (item: T, index: number) => string;
	renderItem: (item: T, index: number) => ReactElement;
	/** Enables the native pull-to-refresh gesture over the list. */
	onRefresh?: () => void;
	isRefreshing?: boolean;
}

/**
 * A native lazy list: rendering and recycling run on the native thread.
 * The generic keeps the caller's item type end-to-end. With `onRefresh` the
 * list is wrapped in the native pull-to-refresh box.
 */
export function BoxyLazyList<T>({
	items,
	keyExtractor,
	renderItem,
	onRefresh,
	isRefreshing,
}: BoxyLazyListProps<T>) {
	const column = (
		<LazyColumn>
			<LazyColumn.Items data={items} keyExtractor={keyExtractor}>
				{({ item, index }) => renderItem(item, index)}
			</LazyColumn.Items>
		</LazyColumn>
	);
	return (
		<Host style={stylesHostFill}>
			{onRefresh ? (
				<PullToRefreshBox
					isRefreshing={isRefreshing === true}
					onRefresh={onRefresh}
				>
					{column}
				</PullToRefreshBox>
			) : (
				column
			)}
		</Host>
	);
}

export interface BoxyNavigationBarProps {
	items: SelectOption[];
	activeValue: string;
	onNavigate: (value: string) => void;
}

/**
 * The native bottom tab bar: a Compose navigation bar whose items drive
 * expo-router navigation. Text-only labels in the boxy theme (the app uses
 * no iconography).
 */
export function BoxyNavigationBar({
	items,
	activeValue,
	onNavigate,
}: BoxyNavigationBarProps) {
	const c = useThemeColors();
	return (
		<Host style={stylesHostStretch}>
			<NavigationBar containerColor={c.background}>
				{items.map((item) => {
					const active = activeValue === item.value;
					return (
						<NavigationBarItem
							key={item.value}
							selected={active}
							onClick={() => {
								onNavigate(item.value);
							}}
							colors={{
								selectedTextColor: c.primary,
								unselectedTextColor: c.mutedForeground,
								selectedIndicatorColor: c.muted,
							}}
						>
							<NavigationBarItem.Label>
								<ComposeText
									color={active ? c.primary : c.mutedForeground}
									style={{ fontSize: 11, fontWeight: "500" }}
								>
									{item.label}
								</ComposeText>
							</NavigationBarItem.Label>
						</NavigationBarItem>
					);
				})}
			</NavigationBar>
		</Host>
	);
}

/** The native in-flight spinner (indeterminate). */
export function BoxyLoadingIndicator({ color }: { color?: string }) {
	const c = useThemeColors();
	return (
		<Host>
			<LoadingIndicator color={color ?? c.primary} />
		</Host>
	);
}

// Host sizing used by full-surface dialogs/lists and stretch controls
// (stable, theme-free).
const stylesHostFill = { flex: 1 } as const;
const stylesHostStretch = { flex: 1 } as const;

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		field: {
			flex: 1,
		},
		fieldLabel: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			textTransform: "uppercase",
		},
		selectControl: {
			marginTop: spacing.xs,
		},
	});
}
