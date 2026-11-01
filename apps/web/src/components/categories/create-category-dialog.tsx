import type {
	CategoryFormInput,
	CategoryFormValues,
	CreateCategoryBody,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCreateCategory } from "@/hooks/use-categories";
import { CATEGORY_TYPE_LABELS } from "@/lib/category-labels";
import { getCategoriesErrorMessage } from "@/services/categories-service";

export const CATEGORY_TYPE_OPTIONS = (
	Object.keys(CATEGORY_TYPE_LABELS) as Array<keyof typeof CATEGORY_TYPE_LABELS>
).map((type) => ({ value: type, label: CATEGORY_TYPE_LABELS[type] }));

// The form keeps color/icon as free-text strings where empty means "unset";
// non-empty values are validated inline with the shared rules (the form
// schema lives in the shared package like the accounts one).

interface CreateCategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateCategoryDialog({
	open,
	onOpenChange,
}: CreateCategoryDialogProps) {
	const create = useCreateCategory();
	const form = useForm<CategoryFormInput, unknown, CategoryFormValues>({
		resolver: zodResolver(categoryFormSchema),
		defaultValues: { name: "", type: "expense", color: "", icon: "" },
	});

	function handleOpenChange(next: boolean) {
		if (!next) {
			form.reset();
			form.clearErrors("root");
		}
		onOpenChange(next);
	}

	function toBody(values: CategoryFormValues): CreateCategoryBody {
		const color = values.color?.trim() ?? "";
		const icon = values.icon?.trim() ?? "";
		return {
			name: values.name,
			type: values.type,
			...(color !== "" ? { color } : {}),
			...(icon !== "" ? { icon } : {}),
		};
	}

	const onSubmit = form.handleSubmit((values) => {
		form.clearErrors("root");
		create.mutate(toBody(values), {
			onSuccess: (category) => {
				handleOpenChange(false);
				toast.success(`Category "${category.name}" created.`);
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
	});

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add category</DialogTitle>
					<DialogDescription>
						Organize income and expenses. Names must be unique.
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
								<FieldLabel htmlFor="category-name">Name</FieldLabel>
								<Input
									id="category-name"
									placeholder="Groceries"
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
							<Field>
								<FieldLabel htmlFor="category-type">Type</FieldLabel>
								<Select
									items={CATEGORY_TYPE_OPTIONS}
									value={field.value}
									onValueChange={(value) => field.onChange(value)}
								>
									<SelectTrigger id="category-type">
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
								<FieldLabel htmlFor="category-color">Color (optional)</FieldLabel>
								<Input
									id="category-color"
									placeholder="#22C55E"
									autoComplete="off"
									className="font-mono"
									{...field}
								/>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : (
									<p className="text-sm text-muted-foreground">
										Hex color like #22C55E. Leave empty for none.
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
								<FieldLabel htmlFor="category-icon">Icon (optional)</FieldLabel>
								<Input
									id="category-icon"
									placeholder="shopping-cart"
									autoComplete="off"
									className="font-mono"
									{...field}
								/>
								{fieldState.error ? (
									<FieldError>{fieldState.error.message}</FieldError>
								) : (
									<p className="text-sm text-muted-foreground">
										Lowercase Lucide icon name. Leave empty for none.
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
						<Button type="submit" disabled={create.isPending}>
							{create.isPending ? "Creating..." : "Create category"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
