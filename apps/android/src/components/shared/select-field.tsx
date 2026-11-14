import * as DropdownMenu from "zeego/dropdown-menu";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
 * labeled, StyleSheet-styled trigger that opens the platform's native
 * dropdown menu (zeego). The trigger and field stay application-styled; the
 * option list renders as system UI, marking the current selection through
 * the checkbox-item state. Dismissing the menu without selecting keeps the
 * current value. `aria-label` carries each option's label for the component
 * test layer; native menus announce their item titles themselves.
 */
export function SelectField({
	label,
	options,
	value,
	placeholder = "Select",
	onValueChange,
}: SelectFieldProps) {
	const c = useThemeColors();
	const styles = useMemo(() => createStyles(c), [c]);
	const selected = options.find((option) => option.value === value);

	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger asChild>
					<Pressable
						accessibilityLabel={label}
						accessibilityRole="button"
						disabled={options.length === 0}
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
				</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					{options.map((option) => {
						const isSelected = option.value === value;
						return (
							<DropdownMenu.CheckboxItem
								key={option.value}
								aria-label={option.label}
								value={isSelected}
								onSelect={() => {
									onValueChange(option.value);
								}}
							>
								<DropdownMenu.ItemIndicator />
								<DropdownMenu.ItemTitle>{option.label}</DropdownMenu.ItemTitle>
							</DropdownMenu.CheckboxItem>
						);
					})}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</View>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
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
		placeholderText: {
			color: c.mutedForeground,
		},
		pressed: {
			opacity: 0.9,
		},
	});
}
