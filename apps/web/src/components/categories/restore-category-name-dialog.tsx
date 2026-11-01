import type { CategoryResponse } from "@finance-application/schemas";
import { categoryNameSchema } from "@finance-application/schemas";
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
import { useState } from "react";

interface RestoreCategoryNameDialogProps {
	category: CategoryResponse;
	pending: boolean;
	onSubmit: (newName: string) => void;
	onOpenChange: (open: boolean) => void;
}

// Shown when a restore is rejected because another category took the name:
// the user picks a new name and the restore is retried with it.
export function RestoreCategoryNameDialog({
	category,
	pending,
	onSubmit,
	onOpenChange,
}: RestoreCategoryNameDialogProps) {
	const [name, setName] = useState(category.name);
	const [error, setError] = useState<string | null>(null);

	function handleSubmit() {
		const parsed = categoryNameSchema.safeParse(name);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Enter a valid name.");
			return;
		}
		setError(null);
		onSubmit(parsed.data);
	}

	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) {
					onOpenChange(false);
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Choose a new name</DialogTitle>
					<DialogDescription>
						Another category already uses "{category.name}". Restore with a
						new name.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						handleSubmit();
					}}
					className="flex flex-col gap-4"
					noValidate
				>
					<Field data-invalid={error !== null || undefined}>
						<FieldLabel htmlFor="restore-category-name">New name</FieldLabel>
						<Input
							id="restore-category-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							autoComplete="off"
						/>
						{error && <FieldError>{error}</FieldError>}
					</Field>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={pending}>
							{pending ? "Restoring..." : "Restore"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
