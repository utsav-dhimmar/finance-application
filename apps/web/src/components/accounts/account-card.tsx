import type { AccountResponse } from "@finance-application/schemas";
import { Card, CardHeader } from "@finance-application/ui/components/card";
import { Coins, Landmark, Wallet } from "lucide-react";
import {
	EntityCardActions,
	EntityCardTitle,
} from "@/components/shared/entity-card";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-labels";
import { formatPaise } from "@/lib/money";

export interface AccountCardProps {
	account: AccountResponse;
	onEdit: (account: AccountResponse) => void;
	onArchive: (account: AccountResponse) => void;
	onDelete: (account: AccountResponse) => void;
	onRestore: (account: AccountResponse) => void;
	// Offered only for trashed accounts when provided: permanent deletion is
	// exclusive to trash and always confirmed by the caller.
	onPermanentDelete?: (account: AccountResponse) => void;
}

function getAccountTypeIcon(type: AccountResponse["type"]) {
	switch (type) {
		case "bank":
			return Landmark;
		case "wallet":
			return Wallet;
		default:
			return Coins;
	}
}

export function AccountCard({
	account,
	onEdit,
	onArchive,
	onDelete,
	onRestore,
	onPermanentDelete,
}: AccountCardProps) {
	const isArchived = account.status === "archived";
	const isDeleted = account.status === "deleted";
	const Icon = getAccountTypeIcon(account.type);

	return (
		<Card className="flex flex-col justify-between transition-[border-color,box-shadow] hover:border-border hover:shadow-xs">
			<CardHeader className="space-y-3 pb-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2.5">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground">
							<Icon aria-hidden="true" className="size-4" />
						</div>
						<EntityCardTitle
							title={account.name}
							typeLabel={ACCOUNT_TYPE_LABELS[account.type]}
							isArchived={isArchived}
							isDeleted={isDeleted}
						/>
					</div>
				</div>

				<div className="pt-1">
					<div className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
						{formatPaise(account.currentBalanceMinor)}
					</div>
					{account.openingBalanceMinor !== account.currentBalanceMinor && (
						<p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
							opening {formatPaise(account.openingBalanceMinor)}
						</p>
					)}
				</div>
			</CardHeader>

			<EntityCardActions
				status={account.status}
				onEdit={() => onEdit(account)}
				onArchive={() => onArchive(account)}
				onDelete={() => onDelete(account)}
				onRestore={() => onRestore(account)}
				onPermanentDelete={
					onPermanentDelete ? () => onPermanentDelete(account) : undefined
				}
			/>
		</Card>
	);
}
