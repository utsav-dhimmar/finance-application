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
import { Plus, Wallet } from "lucide-react";
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
				<p aria-live="polite" className="text-sm text-muted-foreground animate-pulse">
					Loading...
				</p>
			</main>
		);
	}

	if (me.data === null) {
		return null;
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 md:p-8">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
							Accounts
						</h1>
						{tab === "active" && (
							<p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
								Combined balance across active accounts:{" "}
								<span className="font-mono font-semibold text-foreground tabular-nums">
									{formatPaise(accounts.data?.combinedBalanceMinor ?? 0)}
								</span>
							</p>
						)}
					</div>
					<Button onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-xs">
						<Plus aria-hidden="true" className="size-4" />
						Add account
					</Button>
				</div>

				{/* Status Filter Tabs */}
				<div className="flex items-center">
					<Tabs
						value={tab}
						onValueChange={(value) => setTab(value as AccountsTab)}
					>
						<TabsList className="bg-muted/70 p-1">
							{TABS.map((status) => (
								<TabsTrigger key={status} value={status} className="px-3 text-xs">
									{TAB_LABELS[status]}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>

				{/* Accounts Content / Skeletons / Grid */}
				{accounts.isPending ? (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
						<Skeleton className="h-40 w-full rounded-xl" />
						<Skeleton className="h-40 w-full rounded-xl" />
						<Skeleton className="h-40 w-full rounded-xl" />
					</div>
				) : accounts.isError ? (
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
				) : accounts.data.accounts.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
						<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<Wallet aria-hidden="true" className="size-5" />
						</div>
						<p className="mt-3 text-sm text-muted-foreground">
							{EMPTY_MESSAGES[tab]}
						</p>
						{tab === "active" && (
							<Button
								variant="outline"
								size="sm"
								className="mt-4 gap-1.5"
								onClick={() => setCreateOpen(true)}
							>
								<Plus aria-hidden="true" className="size-3.5" />
								Add your first account
							</Button>
						)}
					</div>
				) : (
					<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{accounts.data.accounts.map((account) => (
							<li key={account.id} className="flex">
								<div className="w-full">
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
								</div>
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
