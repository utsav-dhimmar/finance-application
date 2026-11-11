import {
	categoryFormSchema,
	type CategoryFormInput,
	type CategoryFormValues,
	type CategoryResponse,
	type CreateCategoryBody,
	type UpdateCategoryBody,
} from "@finance-application/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
	KeyboardAvoidingView,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { useCreateCategory, useUpdateCategory } from "@/hooks/use-categories";
import { CATEGORY_TYPE_LABELS } from "@/lib/category-labels";
import { getCategoriesErrorMessage } from "@/services/categories-service";
import { hairline, spacing, type ThemeColors, typography } from "@/theme";
import { useThemeColors } from "@/use-theme-colors";

const CATEGORY_TYPE_OPTIONS = (
	Object.keys(CATEGORY_TYPE_LABELS) as Array<keyof typeof CATEGORY_TYPE_LABELS>
).map((type) => ({ value: type, label: CATEGORY_TYPE_LABELS[type] }));

export interface CategoryFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category?: CategoryResponse | null;
}

/**
 * Unified create/edit category dialog (one component, mode-switched like the
 * web's dialog): name, segmented type row, and the presentation color/icon
 * fields — empty color or icon means "unset" (omitted on create, null on
 * edit), exactly the web's mapping. Validation runs against the shared
 * categoryFormSchema.
 */
export function CategoryFormDialog({
	open,
	onOpenChange,
	category = null,
}: CategoryFormDialogProps) {
	const c = useThemeColors();
	const styles = createStyles(c);
	const isEdit = Boolean(category);
	const create = useCreateCategory();
	const update = useUpdateCategory();

	const form = useForm<CategoryFormInput, unknown, CategoryFormValues>({
		resolver: zodResolver(categoryFormSchema),
		defaultValues: { name: "", type: "expense", color: "", icon: "" },
	});

	useEffect(() => {
		if (open) {
			form.reset(
				category
					? {
							name: category.name,
							type: category.type,
							color: category.color ?? "",
							icon: category.icon ?? "",
						}
					: { name: "", type: "expense", color: "", icon: "" },
			);
			form.clearErrors("root");
		}
	}, [open, category, form]);

	function handleOpenChange(next: boolean): void {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		const color = values.color?.trim() ?? "";
		const icon = values.icon?.trim() ?? "";

		if (category) {
			const body: UpdateCategoryBody = {
				name: values.name,
				type: values.type,
				color: color === "" ? null : color,
				icon: icon === "" ? null : icon,
			};
			update.mutate(
				{ id: category.id, body },
				{
					onSuccess: () => {
						handleOpenChange(false);
					},
					onError: (error) => {
						form.setError("root", {
							message: getCategoriesErrorMessage(
								error,
								"Could not save the category. Is the API running?",
							),
						});
					},
				},
			);
		} else {
			const body: CreateCategoryBody = {
				name: values.name,
				type: values.type,
				...(color !== "" ? { color } : {}),
				...(icon !== "" ? { icon } : {}),
			};
			create.mutate(body, {
				onSuccess: () => {
					handleOpenChange(false);
				},
				onError: (error) => {
					form.setError("root", {
						message: getCategoriesErrorMessage(
							error,
							"Could not create the category. Is the API running?",
						),
					});
				},
			});
		}
	});

	const isPending = isEdit ? update.isPending : create.isPending;

	return (
		<Modal
			visible={open}
			transparent
			animationType="fade"
			onRequestClose={() => {
				handleOpenChange(false);
			}}
		>
			<View style={styles.backdrop}>
				<KeyboardAvoidingView behavior="padding">
					<View style={[styles.card, hairline(c.border)]}>
						<Text style={styles.title}>
							{isEdit && category ? `Edit "${category.name}"` : "Add category"}
						</Text>
						<Text style={styles.description}>
							{isEdit
								? "The type locks once transactions reference this category."
								: "Organize income and expenses. Names must be unique."}
						</Text>
						{form.formState.errors.root?.message ? (
							<Text accessibilityRole="alert" style={styles.rootError}>
								{form.formState.errors.root.message}
							</Text>
						) : null}
						<Controller
							control={form.control}
							name="name"
							render={({ field, fieldState }) => (
								<View style={styles.field}>
									<Text style={styles.label}>Name</Text>
									<TextInput
										accessibilityLabel="Category name"
										autoCapitalize="none"
										autoComplete="off"
										onChangeText={field.onChange}
										placeholder={isEdit ? undefined : "Groceries"}
										style={styles.input}
										value={field.value}
									/>
									{fieldState.error ? (
										<Text style={styles.error}>{fieldState.error.message}</Text>
									) : null}
								</View>
							)}
						/>
						<Controller
							control={form.control}
							name="type"
							render={({ field }) => (
								<View style={styles.field}>
									<Text style={styles.label}>Type</Text>
									<View style={styles.typeRow}>
										{CATEGORY_TYPE_OPTIONS.map((option) => {
											const checked = field.value === option.value;
											return (
												<Pressable
													key={option.value}
													accessibilityLabel={option.label}
													accessibilityRole="radio"
													accessibilityState={{ checked }}
													onPress={() => {
														field.onChange(option.value);
													}}
													style={[
														styles.typeOption,
														hairline(c.border),
														checked && styles.typeOptionActive,
													]}
												>
													<Text
														style={[
															styles.typeOptionText,
															checked && styles.typeOptionTextActive,
														]}
													>
														{option.label}
													</Text>
												</Pressable>
											);
										})}
									</View>
								</View>
							)}
						/>
						<Controller
							control={form.control}
							name="color"
							render={({ field, fieldState }) => (
								<View style={styles.field}>
									<Text style={styles.label}>
										{isEdit ? "Color (#RRGGBB)" : "Color (optional)"}
									</Text>
									<TextInput
										accessibilityLabel="Category color"
										autoCapitalize="none"
										autoComplete="off"
										onChangeText={field.onChange}
										placeholder="#22C55E"
										style={[styles.input, styles.mono]}
										value={field.value ?? ""}
									/>
									{fieldState.error ? (
										<Text style={styles.error}>{fieldState.error.message}</Text>
									) : (
										<Text style={styles.helper}>
											{isEdit
												? "Leave empty for none."
												: "Hex color like #22C55E. Leave empty for none."}
										</Text>
									)}
								</View>
							)}
						/>
						<Controller
							control={form.control}
							name="icon"
							render={({ field, fieldState }) => (
								<View style={styles.field}>
									<Text style={styles.label}>
										{isEdit ? "Icon" : "Icon (optional)"}
									</Text>
									<TextInput
										accessibilityLabel="Category icon"
										autoCapitalize="none"
										autoComplete="off"
										onChangeText={field.onChange}
										placeholder="shopping-cart"
										style={[styles.input, styles.mono]}
										value={field.value ?? ""}
									/>
									{fieldState.error ? (
										<Text style={styles.error}>{fieldState.error.message}</Text>
									) : (
										<Text style={styles.helper}>
											{isEdit
												? "Leave empty for none."
												: "Lowercase Lucide icon name. Leave empty for none."}
										</Text>
									)}
								</View>
							)}
						/>
						<View style={styles.footer}>
							<Pressable
								accessibilityRole="button"
								onPress={() => {
									handleOpenChange(false);
								}}
								style={({ pressed }) => [
									styles.footerButton,
									hairline(c.border),
									pressed && styles.pressed,
								]}
							>
								<Text style={styles.cancelText}>Cancel</Text>
							</Pressable>
							<Pressable
								accessibilityRole="button"
								disabled={isPending}
								onPress={() => {
									void onSubmit();
								}}
								style={({ pressed }) => [
									styles.footerButton,
									styles.submitButton,
									isPending && styles.disabled,
									pressed && !isPending && styles.pressed,
								]}
							>
								<Text style={styles.submitText}>
									{isPending
										? isEdit
											? "Saving..."
											: "Creating..."
										: isEdit
											? "Save changes"
											: "Create category"}
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
		backdrop: {
			backgroundColor: "#00000080",
			flex: 1,
			justifyContent: "center",
			padding: spacing.lg,
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
		field: {
			marginTop: spacing.lg,
		},
		footer: {
			flexDirection: "row",
			justifyContent: "flex-end",
			marginTop: spacing.xl,
		},
		footerButton: {
			alignItems: "center",
			borderRadius: 0,
			padding: spacing.md,
		},
		helper: {
			color: c.mutedForeground,
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
			textTransform: "uppercase",
		},
		mono: {
			fontVariant: ["tabular-nums"],
		},
		pressed: {
			opacity: 0.9,
		},
		rootError: {
			color: c.destructive,
			fontSize: typography.sizeSm,
			marginTop: spacing.md,
		},
		submitButton: {
			backgroundColor: c.primary,
			marginLeft: spacing.sm,
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
		typeOption: {
			alignItems: "center",
			borderRadius: 0,
			flex: 1,
			padding: spacing.md,
		},
		typeOptionActive: {
			backgroundColor: c.primary,
			borderColor: c.primary,
		},
		typeOptionText: {
			color: c.foreground,
			fontSize: typography.sizeSm,
		},
		typeOptionTextActive: {
			color: c.primaryForeground,
			fontWeight: typography.weightMedium,
		},
		typeRow: {
			flexDirection: "row",
			gap: spacing.sm,
			marginTop: spacing.xs,
		},
	});
}
