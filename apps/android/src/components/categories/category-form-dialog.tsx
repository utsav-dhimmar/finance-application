import {
	categoryFormSchema,
	type CategoryFormInput,
	type CategoryFormValues,
	type CategoryResponse,
	type CreateCategoryBody,
	type UpdateCategoryBody,
} from "@finance-application/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Host, ModalBottomSheet } from "@expo/ui/jetpack-compose";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import {
	BoxyButtonCore,
	BoxyColumn,
	BoxyFormField,
	BoxyRow,
	BoxySegmentedRow,
	BoxyText,
	BoxyTextFieldCore,
	type SelectOption,
} from "@/components/ui";
import { useCreateCategory, useUpdateCategory } from "@/hooks/use-categories";
import { CATEGORY_TYPE_LABELS } from "@/lib/category-labels";
import { getCategoriesErrorMessage } from "@/services/categories-service";
import { spacing } from "@/theme";
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
	const typeOptions: SelectOption[] = CATEGORY_TYPE_OPTIONS;

	if (!open) {
		return null;
	}

	return (
		<Host style={{ flex: 1 }}>
			<ModalBottomSheet
				onDismissRequest={() => {
					handleOpenChange(false);
				}}
				containerColor={c.background}
				skipPartiallyExpanded
			>
				<BoxyColumn gap={spacing.lg}>
					<BoxyText variant="title">
						{isEdit && category ? `Edit "${category.name}"` : "Add category"}
					</BoxyText>
					<BoxyText variant="body" foreground={c.mutedForeground}>
						{isEdit
							? "The type locks once transactions reference this category."
							: "Organize income and expenses. Names must be unique."}
					</BoxyText>
					{form.formState.errors.root?.message ? (
						<BoxyText variant="body" foreground={c.destructive}>
							{form.formState.errors.root.message}
						</BoxyText>
					) : null}
					<Controller
						control={form.control}
						name="name"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label="Name"
								error={fieldState.error?.message ?? null}
							>
								<BoxyTextFieldCore
									onChangeText={field.onChange}
									placeholder={isEdit ? undefined : "Groceries"}
									value={field.value}
								/>
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="type"
						render={({ field }) => (
							<BoxyFormField label="Type">
								<BoxySegmentedRow
									options={typeOptions}
									value={field.value}
									onValueChange={field.onChange}
								/>
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="color"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label={isEdit ? "Color (#RRGGBB)" : "Color (optional)"}
								error={fieldState.error?.message ?? null}
								helper={
									fieldState.error
										? null
										: isEdit
											? "Leave empty for none."
											: "Hex color like #22C55E. Leave empty for none."
								}
							>
								<BoxyTextFieldCore
									onChangeText={field.onChange}
									placeholder="#22C55E"
									value={field.value ?? ""}
								/>
							</BoxyFormField>
						)}
					/>
					<Controller
						control={form.control}
						name="icon"
						render={({ field, fieldState }) => (
							<BoxyFormField
								label={isEdit ? "Icon" : "Icon (optional)"}
								error={fieldState.error?.message ?? null}
								helper={
									fieldState.error
										? null
										: isEdit
											? "Leave empty for none."
											: "Lowercase Lucide icon name. Leave empty for none."
								}
							>
								<BoxyTextFieldCore
									onChangeText={field.onChange}
									placeholder="shopping-cart"
									value={field.value ?? ""}
								/>
							</BoxyFormField>
						)}
					/>
					<BoxyRow gap={spacing.sm}>
						<BoxyButtonCore
							label="Cancel"
							variant="ghost"
							onPress={() => {
								handleOpenChange(false);
							}}
						/>
						<BoxyButtonCore
							label={isEdit ? "Save changes" : "Create category"}
							onPress={() => {
								void onSubmit();
							}}
							pending={isPending}
						/>
					</BoxyRow>
				</BoxyColumn>
			</ModalBottomSheet>
		</Host>
	);
}
