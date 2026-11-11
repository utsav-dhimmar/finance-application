import type { z } from "zod";

import { useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

export interface RestoreNameDialogProps {
	visible: boolean;
	/** The name that collided, shown in the copy and as the prefill. */
	entityName: string;
	/** Entity kind for the copy, e.g. "account" or "category". */
	noun: string;
	/** The shared name schema whose rules and messages apply. */
	nameSchema: z.ZodType<string>;
	pending?: boolean;
	onSubmit: (newName: string) => void;
	onCancel: () => void;
}

/**
 * Shown when a restore is rejected because another entity took the name:
 * the user picks a new name (validated against the shared schema) and the
 * restore is retried with it — the mobile equivalent of the web's
 * RestoreNameDialog, shared by the accounts and categories screens.
 */
export function RestoreNameDialog({
	visible,
	entityName,
	noun,
	nameSchema,
	pending = false,
	onSubmit,
	onCancel,
}: RestoreNameDialogProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const [name, setName] = useState(entityName);
	const [error, setError] = useState<string | null>(null);

	function handleSubmit(): void {
		const parsed = nameSchema.safeParse(name);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Enter a valid name.");
			return;
		}
		setError(null);
		onSubmit(parsed.data);
	}

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onCancel}
		>
			<View style={styles.backdrop}>
				<KeyboardAvoidingView behavior="padding">
					<View style={[styles.card, hairline(c.border)]}>
						<Text style={styles.title}>Choose a new name</Text>
						<Text style={styles.description}>
							Another {noun} already uses "{entityName}". Restore with a new
							name.
						</Text>
						<Text style={styles.label}>New name</Text>
						<TextInput
							accessibilityLabel="New name"
							autoCapitalize="none"
							autoComplete="off"
							onChangeText={setName}
							style={styles.input}
							value={name}
						/>
						{error !== null ? <Text style={styles.error}>{error}</Text> : null}
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
								<Text style={styles.cancelText}>Cancel</Text>
							</Pressable>
							<Pressable
								accessibilityLabel="Restore with new name"
								accessibilityRole="button"
								disabled={pending}
								onPress={handleSubmit}
								style={({ pressed }) => [
									styles.button,
									styles.submitButton,
									pending && styles.disabled,
									pressed && !pending && styles.pressed,
								]}
							>
								<Text style={styles.submitText}>
									{pending ? "Restoring..." : "Restore"}
								</Text>
							</Pressable>
						</View>
					</View>
				</KeyboardAvoidingView>
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
		description: {
			color: c.mutedForeground,
			fontSize: typography.sizeSm,
			marginTop: spacing.xs,
		},
		disabled: {
			opacity: 0.5,
		},
		error: {
			color: c.destructive,
			fontSize: typography.sizeXs,
			marginTop: spacing.xs,
		},
		input: {
			...hairline(c.border),
			color: c.foreground,
			fontSize: typography.sizeMd,
			marginTop: spacing.xs,
			padding: spacing.md,
		},
		label: {
			color: c.mutedForeground,
			fontSize: typography.sizeXs,
			marginTop: spacing.lg,
			textTransform: "uppercase",
		},
		pressed: {
			opacity: 0.9,
		},
		submitButton: {
			backgroundColor: c.primary,
		},
		submitText: {
			color: c.primaryForeground,
			fontSize: typography.sizeSm,
			fontWeight: typography.weightMedium,
		},
		title: {
			color: c.foreground,
			fontSize: typography.sizeLg,
			fontWeight: typography.weightBold,
		},
	});
}
