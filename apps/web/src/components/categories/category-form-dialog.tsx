import type {
	CategoryFormInput,
	CategoryFormValues,
	CategoryResponse,
	CreateCategoryBody,
	UpdateCategoryBody,
} from "@finance-application/schemas";
import { categoryFormSchema } from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finance-application/ui/components/dialog";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@finance-application/ui/components/field";
import { Input } from "@finance-application/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { TypeSelectField } from "@/components/shared/type-select-field";
import { useCreateCategory, useUpdateCategory } from "@/hooks/use-categories";
import { CATEGORY_TYPE_LABELS } from "@/lib/category-labels";
import { getCategoriesErrorMessage } from "@/services/categories-service";

const CATEGORY_TYPE_OPTIONS = (
	Object.keys(CATEGORY_TYPE_LABELS) as Array<keyof typeof CATEGORY_TYPE_LABELS>
).map((type) => ({ value: type, label: CATEGORY_TYPE_LABELS[type] }));

export interface CategoryFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category?: CategoryResponse | null;
}

export function CategoryFormDialog({
	open,
	onOpenChange,
	category,
}: CategoryFormDialogProps) {
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

	function handleOpenChange(next: boolean) {
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
				onSuccess: (createdCategory) => {
					handleOpenChange(false);
					toast.success(`Category "${createdCategory.name}" created.`);
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
	const idPrefix = isEdit ? "edit-category" : "category";

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEdit && category ? `Edit "${category.name}"` : "Add category"}
					</DialogTitle>
					<DialogDescription>
						{isEdit
							? "The type locks once transactions reference this category."
							: "Organize income and expenses. Names must be unique."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					{form.formState.errors.root?.message && (
						<p role="alert" className="text-sm text-destructive">
							{form.formState.errors.root.message}
						</p>
					)}
					<Controller
						name="name"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
								<Input
									id={`${idPrefix}-name`}
									placeholder={isEdit ? undefined : "Groceries"}
									autoComplete="off"
									{...field}
								/>
								{fieldState.error && (
									<FieldError>{fieldState.error.message}</FieldError>
								)}
							</Field>
						)}
					/>
					<Controller
						name="type"
						control={form.control}
						render={({ field }) => (
							<TypeSelectField
								idPrefix={idPrefix}
								options={CATEGORY_TYPE_OPTIONS}
								value={field.value}
								onChange={(next) => field.onChange(next)}
							/>
						)}
					/>
					<Controller
						name="color"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${idPrefix}-color`}>
									{isEdit ? "Color (#RRGGBB)" : "Color (optional)"}
								</FieldLabel>
								<Input
									id={`${idPrefix}-color`}
									placeholder="#22C55E"
									autoComplete="off"
									className="font-mono"
									{...field}
								/>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : (
									<p className="text-sm text-muted-foreground">
										{isEdit
											? "Leave empty for none."
											: "Hex color like #22C55E. Leave empty for none."}
									</p>
								)}
							</Field>
						)}
					/>
					<Controller
						name="icon"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor={`${idPrefix}-icon`}>
									{isEdit ? "Icon" : "Icon (optional)"}
								</FieldLabel>
								<Input
									id={`${idPrefix}-icon`}
									placeholder="shopping-cart"
									autoComplete="off"
									className="font-mono"
									{...field}
								/>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : (
									<p className="text-sm text-muted-foreground">
										{isEdit
											? "Leave empty for none."
											: "Lowercase Lucide icon name. Leave empty for none."}
									</p>
								)}
							</Field>
						)}
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending
								? isEdit
									? "Saving..."
									: "Creating..."
								: isEdit
									? "Save changes"
									: "Create category"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
