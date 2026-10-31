import { ApiError } from "@finance-application/api-client";
import type { AccountResponse } from "@finance-application/schemas";
import { Button } from "@finance-application/ui/components/button";
import { Skeleton } from "@finance-application/ui/components/skeleton";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@finance-application/ui/components/tabs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountCard } from "@/components/accounts/account-card";
import { ConfirmLifecycleDialog } from "@/components/accounts/confirm-lifecycle-dialog";
import { CreateAccountDialog } from "@/components/accounts/create-account-dialog";
import { EditAccountDialog } from "@/components/accounts/edit-account-dialog";
import { RestoreNameDialog } from "@/components/accounts/restore-name-dialog";
import { AppHeader } from "@/components/app-header";
import {
	useAccounts,
	useArchiveAccount,
	useDeleteAccount,
	useRestoreAccount,
} from "@/hooks/use-accounts";
import { useMe } from "@/hooks/use-auth";
import { formatPaise } from "@/lib/money";
import { getAccountsErrorMessage } from "@/services/accounts-service";

export const Route = createFileRoute("/accounts")({ component: AccountsPage });

type AccountsTab = "active" | "archived" | "deleted";

const TABS: AccountsTab[] = ["active", "archived", "deleted"];

const TAB_LABELS: Record<AccountsTab, string> = {
	active: "Active",
	archived: "Archived",
	deleted: "Trash",
};

const EMPTY_MESSAGES: Record<AccountsTab, string> = {
	active: "No accounts yet. Add your first account to start tracking money.",
	archived: "No archived accounts.",
	deleted: "Trash is empty.",
};

export function AccountsPage() {
	const navigate = useNavigate();
	const me = useMe();
	const [tab, setTab] = useState<AccountsTab>("active");
	const accounts = useAccounts(tab);
	const archive = useArchiveAccount();
	const remove = useDeleteAccount();
	const restore = useRestoreAccount();

	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] = useState<AccountResponse | null>(null);
	const [confirming, setConfirming] = useState<{
		action: "archive" | "delete";
		account: AccountResponse;
	} | null>(null);
	const [renaming, setRenaming] = useState<AccountResponse | null>(null);

	// Guard: unauthenticated visitors are sent to /login without ever seeing
	// account data.
	useEffect(() => {
		if (me.data === null) {
			navigate({ to: "/login" });
		}
	}, [me.data, navigate]);

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

	function handleConfirmLifecycle() {
		if (!confirming) {
			return;
		}
		const { action, account } = confirming;
		const mutation = action === "archive" ? archive : remove;
		mutation.mutate(account.id, {
			onSuccess: (updated) => {
				setConfirming(null);
				toast.success(
					action === "archive"
						? `Account "${updated.name}" archived.`
						: `Account "${updated.name}" moved to trash.`,
				);
			},
			onError: (error) => {
				setConfirming(null);
				toast.error(
					getAccountsErrorMessage(
						error,
						"The change failed. Is the API running?",
					),
				);
			},
		});
	}

	if (me.isPending || me.data === undefined) {
		return (
			<main className="flex min-h-screen items-center justify-center p-8">
				<p aria-live="polite">Loading...</p>
			</main>
		);
	}

	if (me.data === null) {
		return null;
	}

	return (
		<div className="flex min-h-screen flex-col">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h1 className="text-3xl font-bold">Accounts</h1>
						{tab === "active" && (
							<p aria-live="polite" className="text-sm text-muted-foreground">
								Combined balance across active accounts:{" "}
								<span className="font-semibold text-foreground">
									{formatPaise(accounts.data?.combinedBalanceMinor ?? 0)}
								</span>
							</p>
						)}
					</div>
					<Button onClick={() => setCreateOpen(true)}>Add account</Button>
				</div>

				<Tabs
					value={tab}
					onValueChange={(value) => setTab(value as AccountsTab)}
				>
					<TabsList>
						{TABS.map((status) => (
							<TabsTrigger key={status} value={status}>
								{TAB_LABELS[status]}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>

				{accounts.isPending ? (
					<div className="flex flex-col gap-3" aria-hidden="true">
						<Skeleton className="h-28 w-full" />
						<Skeleton className="h-28 w-full" />
					</div>
				) : accounts.isError ? (
					<div
						role="alert"
						className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 p-4"
					>
						<p>Could not load accounts. Is the API running?</p>
						<Button
							variant="outline"
							onClick={() => {
								accounts.refetch();
							}}
						>
							Retry
						</Button>
					</div>
				) : accounts.data.accounts.length === 0 ? (
					<p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
						{EMPTY_MESSAGES[tab]}
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{accounts.data.accounts.map((account) => (
							<li key={account.id}>
								<AccountCard
									account={account}
									onEdit={setEditing}
									onArchive={(target) => {
										setConfirming({
											action: "archive",
											account: target,
										});
									}}
									onDelete={(target) => {
										setConfirming({
											action: "delete",
											account: target,
										});
									}}
									onRestore={handleRestore}
								/>
							</li>
						))}
					</ul>
				)}
			</main>

			<CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} />
			{editing && (
				<EditAccountDialog
					account={editing}
					onOpenChange={(open) => {
						if (!open) {
							setEditing(null);
						}
					}}
				/>
			)}
			{confirming && (
				<ConfirmLifecycleDialog
					action={confirming.action}
					account={confirming.account}
					pending={archive.isPending || remove.isPending}
					onConfirm={handleConfirmLifecycle}
					onOpenChange={(open) => {
						if (!open) {
							setConfirming(null);
						}
					}}
				/>
			)}
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
		</div>
	);
}
