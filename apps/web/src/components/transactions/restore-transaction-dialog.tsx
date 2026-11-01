import type { TransactionResponse } from "@finance-application/schemas";
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
	FieldLabel,
} from "@finance-application/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finance-application/ui/components/select";
import { useState } from "react";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { TRANSACTION_TYPE_LABELS } from "@/lib/transaction-labels";

interface RestoreTransactionDialogProps {
	transaction: TransactionResponse;
	pending: boolean;
	onSubmit: (reassignment: {
		accountId?: string;
		categoryId?: string;
	}) => void;
	onOpenChange: (open: boolean) => void;
}

// Shown when a restore is rejected because the transaction's account or
// category was deleted: the user picks eligible replacements and the restore
// is retried with them. Both sides default to the current references; only
// changed values are sent.
export function RestoreTransactionDialog({
	transaction,
	pending,
	onSubmit,
	onOpenChange,
}: RestoreTransactionDialogProps) {
	const accounts = useAccounts("active");
	const categories = useCategories("active");
	const [accountId, setAccountId] = useState(transaction.accountId);
	const [categoryId, setCategoryId] = useState(transaction.categoryId);

	const accountOptions = accounts.data?.accounts ?? [];
	const categoryOptions = (categories.data?.categories ?? []).filter(
		(category) => category.type === transaction.type,
	);

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
					<DialogTitle>Choose a restore target</DialogTitle>
					<DialogDescription>
						The transaction's account or category was deleted. Assign active
						replacements to restore it.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor="restore-transaction-account">
							{TRANSACTION_TYPE_LABELS[transaction.type] === "Income"
								? "To account"
								: "From account"}
						</FieldLabel>
						<Select
							items={accountOptions.map((account) => ({
								value: account.id,
								label: account.name,
							}))}
							value={accountId}
							onValueChange={(value) => setAccountId(value ?? "")}
						>
							<SelectTrigger id="restore-transaction-account">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{accountOptions.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="restore-transaction-category">
							Category ({TRANSACTION_TYPE_LABELS[transaction.type].toLowerCase()}
							)
						</FieldLabel>
						<Select
							items={categoryOptions.map((category) => ({
								value: category.id,
								label: category.name,
							}))}
							value={categoryId}
							onValueChange={(value) => setCategoryId(value ?? "")}
						>
							<SelectTrigger id="restore-transaction-category">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{categoryOptions.map((category) => (
									<SelectItem key={category.id} value={category.id}>
										{category.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={
							pending ||
							accountOptions.length === 0 ||
							categoryOptions.length === 0
						}
						onClick={() => {
							onSubmit({
								...(accountId !== transaction.accountId
									? { accountId }
									: {}),
								...(categoryId !== transaction.categoryId
									? { categoryId }
									: {}),
							});
						}}
					>
						{pending ? "Restoring..." : "Restore"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
