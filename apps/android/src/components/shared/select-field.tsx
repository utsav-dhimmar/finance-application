import { useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface SelectOption {
	value: string;
	label: string;
}

export interface SelectFieldProps {
	/** Label text; doubles as the field's accessibility label. */
	label: string;
	options: SelectOption[];
	value: string;
	placeholder?: string;
	onValueChange: (value: string) => void;
}

/**
 * The boxy single-select shared by the filter row and the form dialogs: a
 * labeled field that opens a modal option list. No picker dependency —
 * plain Pressables in the boxy theme, like every other surface.
 */
export function SelectField({
	label,
	options,
	value,
	placeholder = "Select",
	onValueChange,
}: SelectFieldProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const [open, setOpen] = useState(false);
	const selected = options.find((option) => option.value === value);

	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<Pressable
				accessibilityLabel={label}
				accessibilityRole="button"
				accessibilityState={{ expanded: open }}
				onPress={() => {
					setOpen(true);
				}}
				style={({ pressed }) => [
					styles.control,
					hairline(c.border),
					pressed && styles.pressed,
				]}
			>
				<Text
					style={[styles.controlText, !selected && styles.placeholderText]}
					numberOfLines={1}
				>
					{selected ? selected.label : placeholder}
				</Text>
			</Pressable>
			<Modal
				visible={open}
				transparent
				animationType="fade"
				onRequestClose={() => {
					setOpen(false);
				}}
			>
				<View style={styles.backdrop}>
					<View style={[styles.sheet, hairline(c.border)]}>
						<Text style={styles.sheetTitle}>{label}</Text>
						{/* Long option lists (e.g. the dashboard's year range) scroll. */}
						<ScrollView style={styles.sheetScroll}>
							{options.map((option) => {
								const isSelected = option.value === value;
								return (
									<Pressable
										key={option.value}
										accessibilityRole="button"
										accessibilityLabel={option.label}
										accessibilityState={{ selected: isSelected }}
										onPress={() => {
											setOpen(false);
											onValueChange(option.value);
										}}
										style={({ pressed }) => [
											styles.option,
											hairline(c.border),
											isSelected && styles.optionSelected,
											pressed && styles.pressed,
										]}
									>
										<Text
											style={[
												styles.optionText,
												isSelected && styles.optionTextSelected,
											]}
										>
											{option.label}
										</Text>
									</Pressable>
								);
							})}
						</ScrollView>
					</View>
				</View>
			</Modal>
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		backdrop: {
			backgroundColor: "#00000080",
			flex: 1,
			justifyContent: "center",
			padding: spacing.lg,
		},
		control: {
			borderRadius: 0,
			marginTop: spacing.xs,
			padding: spacing.md,
		},
		controlText: {
			color: c.foreground,
			fontSize: typography.sizeMd,
		},
		field: {
			flex: 1,
		},
		label: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			textTransform: "uppercase",
		},
		option: {
			borderRadius: 0,
			padding: spacing.md,
		},
		optionSelected: {
			backgroundColor: c.muted,
		},
		optionText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
		},
		optionTextSelected: {
			fontWeight: typography.weightBold,
		},
		placeholderText: {
			color: c.mutedForeground,
		},
		pressed: {
			opacity: 0.9,
		},
		sheet: {
			backgroundColor: c.background,
			padding: spacing.lg,
		},
		sheetScroll: {
			maxHeight: 360,
		},
		sheetTitle: {
			color: c.foreground,
			fontSize: typography.sizeMd,
			fontWeight: typography.weightBold,
			marginBottom: spacing.sm,
		},
	});
}
