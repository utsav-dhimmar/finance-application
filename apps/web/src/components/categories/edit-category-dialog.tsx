import type {
	CategoryFormInput,
	CategoryFormValues,
	CategoryResponse,
	UpdateCategoryBody,
} from "@finance-application/schemas";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useUpdateCategory } from "@/hooks/use-categories";
import { getCategoriesErrorMessage } from "@/services/categories-service";
import { CATEGORY_TYPE_OPTIONS } from "@/components/categories/create-category-dialog";
import { categoryFormSchema } from "@finance-application/schemas";

interface EditCategoryDialogProps {
	category: CategoryResponse;
	onOpenChange: (open: boolean) => void;
}

export function EditCategoryDialog({
	category,
	onOpenChange,
}: EditCategoryDialogProps) {
	const update = useUpdateCategory();
	const form = useForm<CategoryFormInput, unknown, CategoryFormValues>({
		resolver: zodResolver(categoryFormSchema),
		defaultValues: {
			name: category.name,
			type: category.type,
			color: category.color ?? "",
			icon: category.icon ?? "",
		},
	});

	function handleClose(next: boolean) {
		if (!next) {
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		const color = values.color?.trim() ?? "";
		const icon = values.icon?.trim() ?? "";
		const body: UpdateCategoryBody = {
			name: values.name,
			type: values.type,
			// Empty means "unset" on edit: null clears the stored value.
			color: color === "" ? null : color,
			icon: icon === "" ? null : icon,
		};
		update.mutate(
			{ id: category.id, body },
			{
				onSuccess: () => handleClose(false),
				onError: (error) => {
					// Server-side lock and conflict 409s surface inline so the
					// user sees exactly which rule rejected the edit.
					form.setError("root", {
						message: getCategoriesErrorMessage(
							error,
							"Could not save the category. Is the API running?",
						),
					});
				},
			},
		);
	});

	return (
		<Dialog open onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit "{category.name}"</DialogTitle>
					<DialogDescription>
						The type locks once transactions reference this category.
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
								<FieldLabel htmlFor="edit-category-name">Name</FieldLabel>
								<Input id="edit-category-name" {...field} />
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
							<Field>
								<FieldLabel htmlFor="edit-category-type">Type</FieldLabel>
								<Select
									items={CATEGORY_TYPE_OPTIONS}
									value={field.value}
									onValueChange={(value) => field.onChange(value)}
								>
									<SelectTrigger id="edit-category-type">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CATEGORY_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						)}
					/>
					<Controller
						name="color"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="edit-category-color">
									Color (#RRGGBB)
								</FieldLabel>
								<Input
									id="edit-category-color"
									placeholder="#22C55E"
									autoComplete="off"
									className="font-mono"
									{...field}
								/>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : (
									<p className="text-sm text-muted-foreground">
										Leave empty for none.
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
								<FieldLabel htmlFor="edit-category-icon">Icon</FieldLabel>
								<Input
									id="edit-category-icon"
									placeholder="shopping-cart"
									autoComplete="off"
									className="font-mono"
									{...field}
								/>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : (
									<p className="text-sm text-muted-foreground">
										Leave empty for none.
									</p>
								)}
							</Field>
						)}
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleClose(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={update.isPending}>
							{update.isPending ? "Saving..." : "Save changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
