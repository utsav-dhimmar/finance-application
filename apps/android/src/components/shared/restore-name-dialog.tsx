import { AlertDialog, Host } from "@expo/ui/jetpack-compose";
import { useState } from "react";
import type { z } from "zod";

import { spacing } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";
import {
	BoxyButtonCore,
	BoxyColumn,
	BoxyRow,
	BoxyText,
	BoxyTextFieldCore,
} from "@/components/ui";

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
 * RestoreNameDialog, shared by the accounts and categories screens. Backed
 * by the native Compose alert dialog; the conditional mount is the open
 * state.
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

	if (!visible) {
		return null;
	}

	return (
		<Host style={{ flex: 1 }}>
			<AlertDialog onDismissRequest={onCancel}>
				<AlertDialog.Title>
					<BoxyText variant="title">Choose a new name</BoxyText>
				</AlertDialog.Title>
				<AlertDialog.Text>
					<BoxyText variant="body" foreground={c.mutedForeground}>
						Another {noun} already uses "{entityName}". Restore with a new name.
					</BoxyText>
				</AlertDialog.Text>
				<BoxyColumn gap={spacing.lg}>
					<BoxyTextFieldCore
						value={name}
						onChangeText={setName}
						placeholder="New name"
						error={error}
						disabled={pending}
					/>
					<BoxyRow gap={spacing.sm}>
						<BoxyButtonCore
							label="Cancel"
							variant="ghost"
							onPress={onCancel}
							disabled={pending}
						/>
						<BoxyButtonCore
							label="Restore"
							onPress={handleSubmit}
							pending={pending}
						/>
					</BoxyRow>
				</BoxyColumn>
			</AlertDialog>
		</Host>
	);
}
