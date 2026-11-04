import { ApiError } from "@finance-application/api-client";
import type { AccountResponse } from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import { Skeleton } from "@finance-application/ui/components/skeleton";
import { Landmark } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccountCard } from "@/components/accounts/account-card";
import { RestoreNameDialog } from "@/components/accounts/restore-name-dialog";
import { ConfirmTransactionLifecycleDialog } from "@/components/transactions/confirm-transaction-lifecycle-dialog";
import {
	useAccounts,
	usePermanentlyDeleteAccount,
	useRestoreAccount,
} from "@/hooks/use-accounts";
import { getAccountsErrorMessage } from "@/services/accounts-service";

export type PanelMode = "archived" | "deleted";

interface AccountsPanelProps {
	mode: PanelMode;
}

// The unified Archive/Trash slice for accounts: the existing account cards in
// their archived or trashed state, with the established restore flow
// (rename-on-restore included) and, in trash mode, permanent deletion behind
// the typed confirmation.
export function AccountsPanel({ mode }: AccountsPanelProps) {
	const accounts = useAccounts(mode);
	const restore = useRestoreAccount();
	const destroy = usePermanentlyDeleteAccount();

	const [renaming, setRenaming] = useState<AccountResponse | null>(null);
	const [confirming, setConfirming] = useState<AccountResponse | null>(null);

	function handleRestore(account: AccountResponse) {
		restore.mutate(
			{ id: account.id },
			{
				onSuccess: (restored) => {
					toast.success(`Account "${restored.name}" restored.`);
				},
				onError: (error) => {
					if (
						error instanceof ApiError &&
						error.code === "ACCOUNT_NAME_TAKEN"
					) {
						setRenaming(account);
						return;
					}
					toast.error(
						getAccountsErrorMessage(
							error,
							"Could not restore the account. Is the API running?",
						),
					);
				},
			},
		);
	}

	function handleRestoreWithName(newName: string) {
		if (!renaming) {
			return;
		}
		restore.mutate(
			{ id: renaming.id, newName },
			{
				onSuccess: (restored) => {
					setRenaming(null);
					toast.success(`Account "${restored.name}" restored.`);
				},
				onError: (error) => {
					toast.error(
						getAccountsErrorMessage(
							error,
							"Could not restore the account. Is the API running?",
						),
					);
				},
			},
		);
	}

	function handleConfirmPermanentDelete() {
		if (!confirming) {
			return;
		}
		const label = confirming.name;
		destroy.mutate(confirming.id, {
			onSuccess: () => {
				setConfirming(null);
				toast.success(`Account "${label}" permanently deleted.`);
			},
			onError: (error) => {
				setConfirming(null);
				// A blocked deletion surfaces the history-preservation copy.
				toast.error(
					getAccountsErrorMessage(
						error,
						"Could not delete the account. Is the API running?",
					),
				);
			},
		});
	}

	if (accounts.isPending) {
		return (
			<div
				className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
				aria-hidden="true"
			>
				<Skeleton className="h-40 w-full rounded-xl" />
				<Skeleton className="h-40 w-full rounded-xl" />
				<Skeleton className="h-40 w-full rounded-xl" />
			</div>
		);
	}

	if (accounts.isError) {
		return (
			<div
				role="alert"
				className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6"
			>
				<p className="text-sm font-medium text-destructive">
					Could not load accounts. Is the API running?
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						accounts.refetch();
					}}
				>
					Retry
				</Button>
			</div>
		);
	}

	if (accounts.data.accounts.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
				<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<Landmark aria-hidden="true" className="size-5" />
				</div>
				<p className="mt-3 text-sm text-muted-foreground">
					{mode === "archived"
						? "No archived accounts."
						: "Trash is empty."}
				</p>
			</div>
		);
	}

	return (
		<>
			<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{accounts.data.accounts.map((account) => (
					<li key={account.id} className="flex">
						<div className="w-full">
							<AccountCard
								account={account}
								onEdit={() => {}}
								onArchive={() => {}}
								onDelete={() => {}}
								onRestore={handleRestore}
								onPermanentDelete={
									mode === "deleted" ? setConfirming : undefined
								}
							/>
						</div>
					</li>
				))}
			</ul>

			{renaming && (
				<RestoreNameDialog
					account={renaming}
					pending={restore.isPending}
					onSubmit={handleRestoreWithName}
					onOpenChange={(open) => {
						if (!open) {
							setRenaming(null);
						}
					}}
				/>
			)}
			{confirming && (
				<ConfirmTransactionLifecycleDialog
					action="permanent"
					noun="account"
					transactionLabel={confirming.name}
					pending={destroy.isPending}
					onConfirm={handleConfirmPermanentDelete}
					onOpenChange={(open) => {
						if (!open) {
							setConfirming(null);
						}
					}}
				/>
			)}
		</>
	);
}
