import type { AccountResponse } from "@finance-application/schemas";
import { accountNameSchema } from "@finance-application/schemas";
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

interface RestoreNameDialogProps {
	account: AccountResponse;
	pending: boolean;
	onSubmit: (newName: string) => void;
	onOpenChange: (open: boolean) => void;
}

// Shown when a restore is rejected because another account took the name:
// the user picks a new name and the restore is retried with it.
export function RestoreNameDialog({
	account,
	pending,
	onSubmit,
	onOpenChange,
}: RestoreNameDialogProps) {
	const [name, setName] = useState(account.name);
	const [error, setError] = useState<string | null>(null);

	function handleSubmit() {
		const parsed = accountNameSchema.safeParse(name);
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
						Another account already uses "{account.name}". Restore with a new
						name.
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
						<FieldLabel htmlFor="restore-account-name">New name</FieldLabel>
						<Input
							id="restore-account-name"
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
