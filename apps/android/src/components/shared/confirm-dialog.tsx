import {
	ActivityIndicator,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface ConfirmDialogProps {
	visible: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	cancelLabel?: string;
	pending?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * The boxy confirm modal shared by every destructive lifecycle action
 * (archive and soft delete today). Domain copy differs per entity kind, so
 * callers supply the strings; the structure and confirm flow are shared —
 * the mobile equivalent of the web's ConfirmReversibleLifecycleDialog.
 */
export function ConfirmDialog({
	visible,
	title,
	description,
	confirmLabel,
	cancelLabel = "Cancel",
	pending = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onCancel}
		>
			<View style={styles.backdrop}>
				<View style={[styles.card, hairline(c.border)]}>
					<Text style={styles.title}>{title}</Text>
					<Text style={styles.description}>{description}</Text>
					<View style={styles.actions}>
						<Pressable
							accessibilityRole="button"
							onPress={onCancel}
							style={({ pressed }) => [
								styles.button,
								styles.cancelButton,
								pressed && styles.pressed,
							]}
						>
							<Text style={styles.cancelText}>{cancelLabel}</Text>
						</Pressable>
						<Pressable
							accessibilityLabel={confirmLabel}
							accessibilityRole="button"
							disabled={pending}
							onPress={onConfirm}
							style={({ pressed }) => [
								styles.button,
								styles.confirmButton,
								pending && styles.disabled,
								pressed && !pending && styles.pressed,
							]}
						>
							{pending ? (
								<ActivityIndicator color={c.primaryForeground} size="small" />
							) : (
								<Text style={styles.confirmText}>{confirmLabel}</Text>
							)}
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function createStyles(c: ThemeColors) {
	return StyleSheet.create({
		actions: {
			flexDirection: "row",
			justifyContent: "flex-end",
			marginTop: spacing.lg,
		},
		backdrop: {
			backgroundColor: "#00000080",
			flex: 1,
			justifyContent: "center",
			padding: spacing.lg,
		},
		button: {
			alignItems: "center",
			borderRadius: 0,
			padding: spacing.md,
		},
		cancelButton: {
			...hairline(c.border),
			marginRight: spacing.sm,
		},
		cancelText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		card: {
			backgroundColor: c.background,
			padding: spacing.lg,
		},
		confirmButton: {
			backgroundColor: c.primary,
		},
		confirmText: {
			color: c.primaryForeground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		description: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			marginTop: spacing.sm,
		},
		disabled: {
			opacity: 0.5,
		},
		pressed: {
			opacity: 0.9,
		},
		title: {
			color: c.foreground,
			fontSize: typography.sizeLg,
			fontWeight: typography.weightBold,
		},
	});
}
